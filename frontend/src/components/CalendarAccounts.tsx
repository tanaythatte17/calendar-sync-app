import React from 'react';
import { FaGoogle, FaMicrosoft, FaPlus } from 'react-icons/fa';
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
  openMenuId: string | null;
  onMenuToggle: (accountId: string) => void;
}

const CalendarAccounts: React.FC<CalendarAccountsProps> = ({
  accounts,
  selectedCalendars,
  onCalendarToggle,
  onConnectGoogle,
  onConnectMicrosoft,
  onSync,
  onDelete,
  openMenuId,
  onMenuToggle
}) => {
  return (
    <div className="space-y-6">
      {/* Connected Accounts Section */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Connected Accounts</h2>
        </div>
        
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaPlus className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm mb-4">No calendar accounts connected yet</p>
            <p className="text-gray-400 text-xs">Connect your accounts to start syncing events</p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <Account
                key={account._id || account.id || `${account.provider}-${account.email}`}
                account={account}
                selectedCalendars={selectedCalendars}
                onCalendarToggle={onCalendarToggle}
                onSync={onSync}
                onDelete={onDelete}
                openMenuId={openMenuId}
                onMenuToggle={onMenuToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Connect New Accounts Section */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Connect New Account</h3>
        <div className="space-y-3">
          <button
            onClick={onConnectGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
              <FaGoogle className="text-white w-4 h-4" />
            </div>
            <span>Connect Google Calendar</span>
          </button>
          
          <button
            onClick={onConnectMicrosoft}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <FaMicrosoft className="text-white w-4 h-4" />
            </div>
            <span>Connect Microsoft Calendar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarAccounts;
