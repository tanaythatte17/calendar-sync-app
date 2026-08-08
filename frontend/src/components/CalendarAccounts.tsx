import React, { useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { GoogleIcon, MicrosoftIcon } from './icons/BrandIcons';
import Account from './Account';

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

interface CalendarAccountsProps {
  accounts: CalendarAccount[];
  selectedCalendars: { [calendarId: string]: boolean };
  onCalendarToggle: (calendarId: string, checked: boolean) => void;
  onConnectGoogle: () => void;
  onConnectMicrosoft: () => void;
  onSync: (provider: string, email: string) => Promise<void>;
  onDelete: (accountId: string) => Promise<void>;
}

const CalendarAccounts: React.FC<CalendarAccountsProps> = ({
  accounts,
  selectedCalendars,
  onCalendarToggle,
  onConnectGoogle,
  onConnectMicrosoft,
  onSync,
  onDelete
}) => {
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-ucv-border p-5">
      <span className="text-xs font-bold text-ucv-text-faint uppercase tracking-wide block mb-3">
        Connected Accounts
      </span>

      {accounts.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-ucv-surface rounded-full flex items-center justify-center mx-auto mb-4">
            <FaPlus className="w-8 h-8 text-ucv-text-faint" />
          </div>
          <p className="text-ucv-text-muted text-sm mb-4">No calendar accounts connected yet</p>
          <p className="text-ucv-text-faint text-xs">Connect your accounts to start syncing events</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {accounts.map((account) => (
            <Account
              key={account._id || account.id || `${account.provider}-${account.email}`}
              account={account}
              selectedCalendars={selectedCalendars}
              onCalendarToggle={onCalendarToggle}
              onSync={onSync}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => setIsConnectDialogOpen(true)}
        className="w-full mt-2.5 border-[1.5px] border-dashed border-ucv-text-disabled bg-none text-ucv-text-secondary py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 hover:border-ucv-primary hover:text-ucv-primary transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Connect Calendar
      </button>

      {isConnectDialogOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setIsConnectDialogOpen(false)}
        >
          <div
            className="w-full max-w-[360px] bg-white rounded-xl p-7 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-ucv-text mb-1">Connect a calendar</h3>
            <p className="text-ucv-text-muted text-sm mb-5">Choose a provider to connect via secure OAuth 2.0.</p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => { setIsConnectDialogOpen(false); onConnectGoogle(); }}
                className="flex items-center gap-2.5 border border-ucv-border bg-white px-3.5 py-2.5 rounded-lg text-sm font-semibold text-ucv-text hover:bg-ucv-surface hover:border-ucv-text-disabled transition-colors"
              >
                <GoogleIcon size={18} />
                Continue with Google
              </button>
              <button
                onClick={() => { setIsConnectDialogOpen(false); onConnectMicrosoft(); }}
                className="flex items-center gap-2.5 border border-ucv-border bg-white px-3.5 py-2.5 rounded-lg text-sm font-semibold text-ucv-text hover:bg-ucv-surface hover:border-ucv-text-disabled transition-colors"
              >
                <MicrosoftIcon size={16} />
                Continue with Microsoft
              </button>
            </div>
            <button
              onClick={() => setIsConnectDialogOpen(false)}
              className="w-full mt-3.5 border-none bg-none text-ucv-text-muted text-sm font-semibold py-1.5 hover:text-ucv-text-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarAccounts;
