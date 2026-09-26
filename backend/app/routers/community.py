"""
Community groups: the coach creates groups and adds clients; members share a feed
(posts, comments, likes) and a group chat.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_coach
from app.models.client import Client
from app.models.engagement import CommunityGroup, GroupMember, GroupMessage, GroupPost, PostComment, PostLike
from app.models.user import User
from app.schemas.engagement import (
    CommentResponse, GroupBody, GroupMessageBody, GroupMessageResponse, GroupResponse, GroupUpdate, PostBody, PostResponse,
)
from app.services.activity import new_id
from app.services.events import broker
from app.services.notify import notify

router = APIRouter(prefix="/community", tags=["Community"])


async def _member_client_ids(db: AsyncSession, group_id: str) -> List[str]:
    return list((await db.execute(select(GroupMember.client_id).where(GroupMember.group_id == group_id))).scalars().all())


async def _audience(db: AsyncSession, group: CommunityGroup) -> List[str]:
    """User ids of the coach and every member's login."""
    clients = await _member_client_ids(db, group.id)
    users = (await db.execute(select(User.id).where(User.client_id.in_(clients), User.is_active == True))).scalars().all()  # noqa: E712
    return [group.coach_id, *users]


async def _get_group(group_id: str, user: User, db: AsyncSession) -> CommunityGroup:
    """The coach who owns it, or a client who is a member; otherwise 404."""
    group = await db.get(CommunityGroup, group_id)
    if group and user.role == "coach" and group.coach_id == user.id:
        return group
    if group and user.role == "client":
        member = (await db.execute(
            select(GroupMember.id).where(GroupMember.group_id == group_id, GroupMember.client_id == user.client_id)
        )).first()
        if member:
            return group
    raise HTTPException(status_code=404, detail="Group not found")


async def _check_clients(db: AsyncSession, coach: User, client_ids: List[str]) -> List[str]:
    ids = list(dict.fromkeys(client_ids))
    if not ids:
        return []
    owned = set((await db.execute(select(Client.id).where(Client.id.in_(ids), Client.coach_id == coach.id))).scalars().all())
    if owned != set(ids):
        raise HTTPException(status_code=404, detail="Client not found")
    return ids


async def _group_response(db: AsyncSession, group: CommunityGroup) -> GroupResponse:
    return GroupResponse(id=group.id, name=group.name, description=group.description,
                         client_ids=await _member_client_ids(db, group.id), created_at=group.created_at)


async def _author(user: User, db: AsyncSession) -> str:
    if user.role == "client" and user.client_id:
        client = await db.get(Client, user.client_id)
        if client:
            return client.name
    return user.full_name


# --- Groups ----------------------------------------------------------------------

@router.get("/groups", response_model=List[GroupResponse])
async def list_groups(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role == "coach":
        query = select(CommunityGroup).where(CommunityGroup.coach_id == user.id)
    else:
        query = select(CommunityGroup).join(GroupMember, GroupMember.group_id == CommunityGroup.id).where(GroupMember.client_id == user.client_id)
    groups = (await db.execute(query.order_by(CommunityGroup.name))).scalars().all()
    return [await _group_response(db, g) for g in groups]


@router.post("/groups", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(body: GroupBody, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    ids = await _check_clients(db, coach, body.client_ids)
    group = CommunityGroup(id=new_id("grp"), coach_id=coach.id, name=body.name.strip(), description=body.description)
    db.add(group)
    db.add_all([GroupMember(id=new_id("gm"), group_id=group.id, client_id=cid) for cid in ids])
    await db.commit()
    return await _group_response(db, group)


@router.patch("/groups/{group_id}", response_model=GroupResponse)
async def update_group(group_id: str, body: GroupUpdate, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    group = await _get_group(group_id, coach, db)
    if body.name is not None:
        group.name = body.name.strip()
    if body.description is not None:
        group.description = body.description
    if body.client_ids is not None:
        ids = await _check_clients(db, coach, body.client_ids)
        current = set(await _member_client_ids(db, group.id))
        await db.execute(delete(GroupMember).where(GroupMember.group_id == group.id, GroupMember.client_id.not_in(ids)))
        db.add_all([GroupMember(id=new_id("gm"), group_id=group.id, client_id=cid) for cid in ids if cid not in current])
    await db.commit()
    return await _group_response(db, group)


@router.delete("/groups/{group_id}")
async def delete_group(group_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    group = await _get_group(group_id, coach, db)
    post_ids = select(GroupPost.id).where(GroupPost.group_id == group.id)
    await db.execute(delete(PostComment).where(PostComment.post_id.in_(post_ids)))
    await db.execute(delete(PostLike).where(PostLike.post_id.in_(post_ids)))
    for model in (GroupPost, GroupMessage, GroupMember):
        await db.execute(delete(model).where(model.group_id == group.id))
    await db.delete(group)
    await db.commit()
    return {"message": "Group deleted", "id": group_id}


# --- Feed ------------------------------------------------------------------------

async def _post_responses(db: AsyncSession, posts: List[GroupPost], user: User) -> List[PostResponse]:
    ids = [p.id for p in posts]
    if not ids:
        return []
    likes = dict((await db.execute(
        select(PostLike.post_id, func.count()).where(PostLike.post_id.in_(ids)).group_by(PostLike.post_id)
    )).all())
    mine = set((await db.execute(select(PostLike.post_id).where(PostLike.post_id.in_(ids), PostLike.user_id == user.id))).scalars().all())
    comments = (await db.execute(select(PostComment).where(PostComment.post_id.in_(ids)).order_by(PostComment.created_at))).scalars().all()
    by_post = {}
    for c in comments:
        by_post.setdefault(c.post_id, []).append(CommentResponse.model_validate(c))
    return [
        PostResponse(**PostResponse.model_validate(p).model_dump(exclude={"like_count", "liked_by_me", "comments"}),
                     like_count=likes.get(p.id, 0), liked_by_me=p.id in mine, comments=by_post.get(p.id, []))
        for p in posts
    ]


@router.get("/groups/{group_id}/posts", response_model=List[PostResponse])
async def list_posts(
    group_id: str,
    before: Optional[datetime] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_group(group_id, user, db)
    query = select(GroupPost).where(GroupPost.group_id == group_id)
    if before:
        query = query.where(GroupPost.created_at < before.replace(tzinfo=None))
    posts = (await db.execute(query.order_by(GroupPost.pinned.desc(), GroupPost.created_at.desc()).limit(30))).scalars().all()
    return await _post_responses(db, list(posts), user)


@router.post("/groups/{group_id}/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(group_id: str, body: PostBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group(group_id, user, db)
    post = GroupPost(id=new_id("post"), group_id=group.id, author_user_id=user.id, author_name=await _author(user, db),
                     author_role=user.role, body=body.body.strip())
    db.add(post)
    await db.commit()
    audience = await _audience(db, group)
    broker.publish(audience, "community", {"groupId": group.id, "kind": "post"})
    # Only the coach's posts notify everyone; member posts would be noisy.
    if user.role == "coach":
        await notify(db, [u for u in audience if u != user.id], "community_post",
                     f"New post in {group.name}", body.body[:140], {"tab": "community", "groupId": group.id})
    return (await _post_responses(db, [post], user))[0]


async def _get_post(post_id: str, user: User, db: AsyncSession) -> tuple[GroupPost, CommunityGroup]:
    post = await db.get(GroupPost, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post, await _get_group(post.group_id, user, db)


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    post, group = await _get_post(post_id, user, db)
    if post.author_user_id != user.id and group.coach_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    await db.execute(delete(PostComment).where(PostComment.post_id == post.id))
    await db.execute(delete(PostLike).where(PostLike.post_id == post.id))
    await db.delete(post)
    await db.commit()
    broker.publish(await _audience(db, group), "community", {"groupId": group.id, "kind": "post"})
    return {"message": "Post deleted", "id": post_id}


@router.post("/posts/{post_id}/pin", response_model=PostResponse)
async def toggle_pin(post_id: str, coach: User = Depends(require_coach), db: AsyncSession = Depends(get_db)):
    post, _ = await _get_post(post_id, coach, db)
    post.pinned = not post.pinned
    await db.commit()
    return (await _post_responses(db, [post], coach))[0]


@router.post("/posts/{post_id}/like", response_model=PostResponse)
async def toggle_like(post_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    post, group = await _get_post(post_id, user, db)
    existing = (await db.execute(select(PostLike).where(PostLike.post_id == post.id, PostLike.user_id == user.id))).scalar_one_or_none()
    if existing:
        await db.delete(existing)
    else:
        db.add(PostLike(id=new_id("like"), post_id=post.id, user_id=user.id))
    await db.commit()
    broker.publish(await _audience(db, group), "community", {"groupId": group.id, "kind": "post"})
    return (await _post_responses(db, [post], user))[0]


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(post_id: str, body: PostBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    post, group = await _get_post(post_id, user, db)
    comment = PostComment(id=new_id("cmt"), post_id=post.id, author_user_id=user.id, author_name=await _author(user, db),
                          author_role=user.role, body=body.body.strip())
    db.add(comment)
    await db.commit()
    broker.publish(await _audience(db, group), "community", {"groupId": group.id, "kind": "post"})
    if post.author_user_id != user.id:
        await notify(db, [post.author_user_id], "community_comment", f"{comment.author_name} commented on your post",
                     body.body[:140], {"tab": "community", "groupId": group.id})
    return CommentResponse.model_validate(comment)


@router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    comment = await db.get(PostComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    _, group = await _get_post(comment.post_id, user, db)
    if comment.author_user_id != user.id and group.coach_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    await db.delete(comment)
    await db.commit()
    return {"message": "Comment deleted", "id": comment_id}


# --- Group chat ------------------------------------------------------------------

@router.get("/groups/{group_id}/messages", response_model=List[GroupMessageResponse])
async def list_group_messages(group_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_group(group_id, user, db)
    rows = (await db.execute(
        select(GroupMessage).where(GroupMessage.group_id == group_id).order_by(GroupMessage.created_at.desc()).limit(200)
    )).scalars().all()
    return list(reversed(rows))


@router.post("/groups/{group_id}/messages", response_model=GroupMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_group_message(group_id: str, body: GroupMessageBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group(group_id, user, db)
    msg = GroupMessage(id=new_id("gmsg"), group_id=group.id, author_user_id=user.id, author_name=await _author(user, db),
                       author_role=user.role, text=body.text.strip())
    db.add(msg)
    await db.commit()
    out = GroupMessageResponse.model_validate(msg)
    broker.publish(await _audience(db, group), "group_message", out.model_dump(by_alias=True, mode="json"))
    return out
