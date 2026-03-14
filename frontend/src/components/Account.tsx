import React from 'react';
import { FaGoogle, FaMicrosoft, FaEllipsisV, FaSync, FaTrash } from 'react-icons/fa';

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
  openMenuId: string | null;
  onMenuToggle: (accountId: string) => void;
}

const Account: React.FC<AccountProps> = ({
  account,
  selectedCalendars,
  onCalendarToggle,
  onSync,
  onDelete,
  openMenuId,
  onMenuToggle
}) => {
  const accountKey = account._id || account.id || `${account.provider}-${account.email}`;
  const isMenuOpen = openMenuId === accountKey;

  const handleSync = async () => {
    await onSync(account.provider, account.email);
    onMenuToggle(accountKey);
  };

  const handleDelete = async () => {
    await onDelete(account._id ?? account.id);
    onMenuToggle(accountKey);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {account.provider === 'google' ? (
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <FaGoogle className="text-white w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <FaMicrosoft className="text-white w-5 h-5" />
              </div>
            )}
            
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 text-sm truncate" title={account.email}>
                {account.email}
              </h3>
              <p className="text-xs text-gray-500 capitalize">
                {account.provider} Calendar
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => onMenuToggle(accountKey)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              title="More options"
            >
              <FaEllipsisV className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <button
                  onClick={handleSync}
                  className="w-full px-4 py-3 text-left text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-3"
                >
                  <FaSync className="w-4 h-4" />
                  Sync Calendar
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center gap-3"
                >
                  <FaTrash className="w-4 h-4" />
                  Delete Account
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Calendar List */}
        {account.calendarList && account.calendarList.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">
              Available Calendars
            </h4>
            <div className="space-y-2">
              {account.calendarList.map((cal) => (
                <label
                  key={cal.calendarId}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-all cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={!!selectedCalendars[cal.calendarId]}
                    onChange={(e) => onCalendarToggle(cal.calendarId, e.target.checked)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-white rounded border-gray-300"
                  />
                  <div
                    className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: cal.color || '#e0e7ff' }}
                  />
                  <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                    {cal.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Account;
