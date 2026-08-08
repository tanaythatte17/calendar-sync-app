import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { RefreshCw, Shield, Zap, Lock, Webhook, EyeOff, ArrowRight } from 'lucide-react';
import { GoogleIcon, MicrosoftIcon } from './icons/BrandIcons';

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="bg-white border border-ucv-border rounded-xl p-7 h-full">
    <div className="w-11 h-11 rounded-lg bg-ucv-primary-light text-ucv-primary flex items-center justify-center mb-5">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-ucv-text mb-2">{title}</h3>
    <p className="text-sm leading-relaxed text-ucv-text-muted">{description}</p>
  </div>
);

const StepCard: React.FC<{ n: string; title: string; description: string }> = ({ n, title, description }) => (
  <div className="bg-ucv-surface border border-ucv-border rounded-xl p-7">
    <div className="w-10 h-10 rounded-lg bg-ucv-primary text-white flex items-center justify-center font-bold text-sm mb-5">
      {n}
    </div>
    <h3 className="text-lg font-bold text-ucv-text mb-2">{title}</h3>
    <p className="text-sm leading-relaxed text-ucv-text-muted">{description}</p>
  </div>
);

const SecurityCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="bg-white border border-ucv-border rounded-xl p-6">
    <div className="w-9 h-9 rounded-lg bg-ucv-primary-light text-ucv-primary flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="text-base font-bold text-ucv-text mb-1.5">{title}</h3>
    <p className="text-sm leading-relaxed text-ucv-text-muted">{description}</p>
  </div>
);

const Landing: React.FC = () => {

  return (
    <>
      <Helmet>
        <title>Unified Calendar View - Sync Google & Microsoft Calendars in Real-Time</title>
        <meta name="description" content="Stop switching between calendar apps. Sync Google Calendar and Microsoft Outlook in one unified dashboard with instant real-time updates. Secure, fast, and privacy-focused." />
        <meta name="keywords" content="calendar sync, google calendar, microsoft outlook, calendar integration, unified calendar, real-time sync, calendar management" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Unified Calendar View - Sync Google & Microsoft Calendars" />
        <meta property="og:description" content="Stop switching between calendar apps. Get real-time calendar sync across Google Calendar and Outlook in one unified dashboard." />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Unified Calendar View - Sync Google & Microsoft Calendars" />
        <meta name="twitter:description" content="Stop switching between calendar apps. Get real-time calendar sync across Google Calendar and Outlook in one unified dashboard." />

        <link rel="canonical" href="https://unifiedcalendarview.com" />
      </Helmet>

      <div className="bg-white text-ucv-text">
        {/* Hero */}
        <div className="max-w-3xl mx-auto px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-1.5 bg-ucv-primary-light text-ucv-primary px-3.5 py-1.5 rounded-lg text-sm font-semibold mb-6">
            <RefreshCw className="w-3.5 h-3.5" />
            Real-time calendar sync
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-6">
            Sync Google and Microsoft Calendars in Real Time
          </h1>
          <p className="text-lg sm:text-xl leading-relaxed text-ucv-text-muted max-w-2xl mx-auto mb-10">
            Secure OAuth 2.0 authentication, instant synchronization across multiple calendars, and a single unified view — on any platform.
          </p>
          <div className="flex gap-3.5 justify-center flex-wrap">
            <RouterLink
              to="/register"
              className="bg-ucv-primary text-white px-7 py-3.5 rounded-lg text-[15px] font-semibold hover:bg-ucv-primary-hover transition-colors"
            >
              Get Started
            </RouterLink>
            <a
              href="#how-it-works"
              className="bg-white text-ucv-text px-7 py-3.5 rounded-lg text-[15px] font-semibold border border-ucv-border hover:border-ucv-text-disabled transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* How It Works */}
        <div id="how-it-works" className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">How It Works</h2>
          <p className="text-center text-ucv-text-muted text-base mb-12">Three steps to a unified calendar.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StepCard
              n="01"
              title="Connect your account"
              description="Sign in with Google or Microsoft using secure OAuth 2.0 — we never see your password."
            />
            <StepCard
              n="02"
              title="We securely sync your calendars"
              description="Events, calendars, and colors sync automatically in the background via encrypted webhooks."
            />
            <StepCard
              n="03"
              title="Receive real-time updates instantly"
              description="Changes appear the moment they happen, pushed live over an authenticated connection."
            />
          </div>
        </div>

        {/* Features */}
        <div className="max-w-5xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Zap className="w-5 h-5" />}
              title="Instant Real-Time Sync"
              description="Webhook-powered updates mean your calendar changes appear instantly across all platforms. Create an event in Google Calendar and see it immediately in your unified view."
            />
            <FeatureCard
              icon={<EyeOff className="w-5 h-5" />}
              title="Privacy-First Calendar Access"
              description="We only access your calendar data - nothing else. Your emails, files, and other account information remain completely private and secure."
            />
            <FeatureCard
              icon={<RefreshCw className="w-5 h-5" />}
              title="Lightning-Fast Calendar Sync"
              description="No more waiting for calendar updates. Our advanced sync technology ensures your Google and Microsoft calendars update in real-time, every time."
            />
          </div>
        </div>

        {/* Security */}
        <div className="bg-ucv-surface border-y border-ucv-border py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-1.5 bg-ucv-green-light text-ucv-green px-3.5 py-1.5 rounded-lg text-sm font-semibold mb-4">
                <Shield className="w-3.5 h-3.5" />
                Security first
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">Your calendar data, protected end to end</h2>
              <p className="text-ucv-text-muted text-base max-w-xl mx-auto">We built this the way a security team would want it built.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <SecurityCard
                icon={<Lock className="w-[18px] h-[18px]" />}
                title="OAuth 2.0 authentication"
                description="You sign in directly with Google or Microsoft. We never see or store your password."
              />
              <SecurityCard
                icon={<Shield className="w-[18px] h-[18px]" />}
                title="Encrypted access tokens"
                description="Access tokens are encrypted at rest and scoped to calendar read/write only."
              />
              <SecurityCard
                icon={<Shield className="w-[18px] h-[18px]" />}
                title="Encrypted refresh tokens"
                description="Refresh tokens use the same encryption standard, never stored in plain text."
              />
              <SecurityCard
                icon={<Webhook className="w-[18px] h-[18px]" />}
                title="Change-only webhooks"
                description="Providers notify us only when something changes — never full calendar contents."
              />
              <SecurityCard
                icon={<RefreshCw className="w-[18px] h-[18px]" />}
                title="Authenticated real-time sync"
                description="Live updates stream over an authenticated, per-user connection."
              />
              <SecurityCard
                icon={<EyeOff className="w-[18px] h-[18px]" />}
                title="Your data stays private"
                description="Your calendar data is never shared, sold, or used for anything but sync."
              />
            </div>
          </div>
        </div>

        {/* Supported Providers */}
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold tracking-tight mb-12">Supported Providers</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="border border-ucv-border rounded-xl p-7 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-white border border-ucv-border flex items-center justify-center flex-shrink-0">
                <GoogleIcon size={24} />
              </div>
              <div className="flex-1">
                <div className="font-bold text-base">Google Calendar</div>
                <div className="text-ucv-text-muted text-sm">Full two-way sync</div>
              </div>
              <div className="bg-ucv-green-light text-ucv-green text-xs font-semibold px-2.5 py-1 rounded-md flex-shrink-0">Supported</div>
            </div>
            <div className="border border-ucv-border rounded-xl p-7 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-white border border-ucv-border flex items-center justify-center flex-shrink-0">
                <MicrosoftIcon size={22} />
              </div>
              <div className="flex-1">
                <div className="font-bold text-base">Microsoft Outlook Calendar</div>
                <div className="text-ucv-text-muted text-sm">Full two-way sync</div>
              </div>
              <div className="bg-ucv-green-light text-ucv-green text-xs font-semibold px-2.5 py-1 rounded-md flex-shrink-0">Supported</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-ucv-primary py-16 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-4">Ready to Unify Your Calendar Experience?</h2>
            <p className="text-white/90 text-base sm:text-lg leading-relaxed mb-8">
              Join thousands who've stopped juggling multiple calendar apps. Connect your Google and Microsoft calendars today and experience seamless real-time synchronization.
            </p>
            <div className="flex justify-center gap-3.5 flex-wrap">
              <RouterLink
                to="/register"
                className="bg-white text-ucv-primary px-7 py-3.5 rounded-lg text-[15px] font-semibold hover:bg-ucv-primary-light transition-colors inline-flex items-center gap-2"
              >
                Start Syncing Now
                <ArrowRight className="w-4 h-4" />
              </RouterLink>
              <RouterLink
                to="/login"
                className="border border-white/60 text-white px-7 py-3.5 rounded-lg text-[15px] font-semibold hover:bg-white/10 transition-colors"
              >
                Sign In
              </RouterLink>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-ucv-border py-10 px-6 text-center">
          <p className="text-sm text-ucv-text-muted mb-2">
            For any questions feel free to reach out to admin@unifiedcalendarview.com
          </p>
          <RouterLink to="/policy" className="text-sm font-semibold text-ucv-primary hover:underline">
            Privacy Policy
          </RouterLink>
        </div>
      </div>
    </>
  );
};

export default Landing;
