import React, { useState } from 'react';
import { localDateStr } from '../../utils/dates';
import { DiaryView } from '../nutrition/DiaryView';

export const ClientNutrition: React.FC<{ clientId: string }> = ({ clientId }) => {
  const today = localDateStr();
  const [date, setDate] = useState(today);
  return (
    <div className="max-w-3xl">
      <DiaryView clientId={clientId} date={date} today={today} onDateChange={setDate} />
    </div>
  );
};
