import React, { useState } from 'react';
import { FaUser, FaCalendarCheck, FaExternalLinkAlt, FaRocket } from 'react-icons/fa';
import { useAuth, api } from '../contexts/AuthContext';

const AccountInfo: React.FC = () => {
  const { user } = useAuth();
  const [accountStatus] = useState<'trial' | 'expired' | 'active'>('trial'); // TODO: Fetch from API

  const today = new Date();
  const formattedDate = today.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const displayName = user?.name || user?.email || 'User';

  const handleManageSubscription = async () => {
    try {
      const response = await api.get('/polar/checkout/link');
      console.log(response);
    } catch (error) {
      console.error('Error fetching checkout link:', error);
    }
  };

  const handleBeginSubscription = async () => {
    try {
      const response = await api.get('/polar/checkout/link');
      console.log(response.data);
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Error fetching checkout link:', error);
    }
  };

  const isTrialOrExpired = accountStatus === 'trial' || accountStatus === 'expired';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-md">
            <FaUser className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Account</h1>
            <p className="text-sm text-gray-500">Manage your subscription and profile</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <span className="text-sm text-gray-500">Name</span>
            <span className="text-sm font-medium text-gray-900">{displayName}</span>
          </div>

          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <span className="text-sm text-gray-500">Account Status</span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
              accountStatus === 'trial' 
                ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                : accountStatus === 'expired'
                ? 'bg-red-50 text-red-700 border-red-100'
                : 'bg-green-50 text-green-700 border-green-100'
            }`}>
              {accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Expiry Date</span>
            <span className="text-sm font-medium text-gray-900">{formattedDate}</span>
          </div>
        </div>

        <div className="mt-8">
          {isTrialOrExpired ? (
            <button
              type="button"
              onClick={handleBeginSubscription}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-sm hover:from-blue-700 hover:to-indigo-700 hover:shadow-md transition-all"
            >
              <FaRocket className="w-4 h-4" />
              <span>Begin Subscription</span>
              <FaExternalLinkAlt className="w-3 h-3 opacity-80" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleManageSubscription}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-sm hover:from-blue-700 hover:to-indigo-700 hover:shadow-md transition-all"
            >
              <FaCalendarCheck className="w-4 h-4" />
              <span>View / Cancel Subscription</span>
              <FaExternalLinkAlt className="w-3 h-3 opacity-80" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountInfo;

