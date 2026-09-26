"""Grant (or with --revoke, remove) platform admin rights: python scripts/make_admin.py email@example.com"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402


async def main(email: str, admin: bool) -> None:
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email.strip().lower()))).scalar_one_or_none()
        if not user or user.role != "coach":
            sys.exit(f"No coach account for {email}")
        user.is_admin = admin
        await db.commit()
        print(f"{user.email}: admin={admin}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    asyncio.run(main(args[0], "--revoke" not in sys.argv))
