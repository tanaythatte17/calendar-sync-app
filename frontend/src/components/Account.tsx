import React from 'react';
import { GoogleIcon, MicrosoftIcon } from './icons/BrandIcons';

interface CalendarListItem {
  calendarId: string;
  name: string;
  color?: string;
}

interface CalendarAccount {
  id: string;
  _id?: string;
  provider: 'google' | 'microsoft';
  email: string;
  isConnected: boolean;
  calendarList?: CalendarListItem[];
}

interface AccountProps {
  account: CalendarAccount;
  selectedCalendars: { [calendarId: string]: boolean };
  onCalendarToggle: (calendarId: string, checked: boolean) => void;
  onSync: (provider: string, email: string) => Promise<void>;
  onDelete: (accountId: string) => Promise<void>;
}

const Account: React.FC<AccountProps> = ({
  account,
  selectedCalendars,
  onCalendarToggle,
  onSync,
  onDelete
}) => {
  const handleSync = async () => {
    await onSync(account.provider, account.email);
  };

  const handleDelete = async () => {
    await onDelete(account._id ?? account.id);
  };

  return (
    <div className="border border-ucv-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-[26px] h-[26px] bg-white border border-ucv-border rounded-md flex items-center justify-center flex-shrink-0">
          {account.provider === 'google' ? <GoogleIcon size={14} /> : <MicrosoftIcon size={13} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-ucv-text truncate" title={account.email}>
            {account.email}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${account.isConnected ? 'bg-ucv-green' : 'bg-ucv-text-disabled'}`} />
            <span className="text-xs text-ucv-text-faint">{account.isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        <button
          title="Sync Calendar"
          onClick={handleSync}
          className="w-6 h-6 border border-ucv-border bg-white rounded-md flex items-center justify-center hover:border-ucv-text-disabled hover:bg-ucv-surface transition-colors flex-shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ucv-text-muted">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
        <button
          title="Disconnect"
          onClick={handleDelete}
          className="w-6 h-6 border border-ucv-border bg-white rounded-md flex items-center justify-center hover:border-ucv-danger hover:bg-ucv-danger-light transition-colors flex-shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ucv-danger">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Calendar List */}
      {account.calendarList && account.calendarList.length > 0 && (
        <div className="flex flex-col gap-px border-t border-ucv-border-light pt-2">
          {account.calendarList.map((cal) => (
            <label
              key={cal.calendarId}
              className="flex items-center gap-2 py-[5px] px-1 rounded-md hover:bg-ucv-surface transition-all cursor-pointer"
            >
              <div
                className="w-[11px] h-[11px] rounded-[3px] flex-shrink-0"
                style={{ backgroundColor: cal.color || '#5B6E3A' }}
              />
              <span className="flex-1 text-sm text-ucv-text-secondary truncate">
                {cal.name}
              </span>
              <input
                type="checkbox"
                checked={!!selectedCalendars[cal.calendarId]}
                onChange={(e) => onCalendarToggle(cal.calendarId, e.target.checked)}
                className="w-[15px] h-[15px] accent-ucv-primary flex-shrink-0 cursor-pointer"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default Account;
