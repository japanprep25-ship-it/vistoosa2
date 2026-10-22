// src/connect/ConnectChannelsPanel.tsx
// -----------------------------------------------------------------------
// "Connect your channels" Compact Panel for the Social Inbox Page
// Featuring WhatsApp Embedded Signup with Phone Number + OTP
// -----------------------------------------------------------------------

import React, { useState, useEffect, useCallback } from 'react';
import {
  Share2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  MessageCircle,
  Instagram,
  Check,
  Shield,
  Unlink,
  ChevronRight,
  ChevronDown,
  Info,
  X,
  Lock,
  Phone,
  Sparkles,
  Smartphone,
} from 'lucide-react';

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

interface ChannelStatus {
  appConfigured: boolean;
  metaAppId?: string;
  facebook: {
    connected: boolean;
    pageId?: string;
    pageName?: string;
    connectedAt?: string | null;
  };
  instagram: {
    connected: boolean;
    instagramBusinessAccountId?: string;
    username?: string;
  };
  whatsapp: {
    connected: boolean;
    phoneNumberId?: string;
    wabaId?: string;
    verifiedName?: string;
    displayNumber?: string;
    qualityRating?: string | null;
    webhookSubscribed?: boolean;
    tokenExpiresAt?: string | null;
  };
  isOwner?: boolean;
}

interface FacebookPageOption {
  id: string;
  name: string;
  accessToken: string;
  igBusinessAccountId?: string | null;
  igUsername?: string | null;
}

interface WaEmbeddedConfig {
  appId: string;
  configId: string;
  graphVersion: string;
}

interface EmbeddedStepDetail {
  name: string;
  ok: boolean;
  error?: string;
  detail?: string;
}

// Single-instance Facebook SDK loader
let fbSdkPromise: Promise<any> | null = null;
function loadFacebookSdk(appId: string, graphVersion: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window unavailable'));
  if (window.FB) {
    try {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: graphVersion || 'v21.0',
      });
    } catch {}
    return Promise.resolve(window.FB);
  }

  if (fbSdkPromise) return fbSdkPromise;

  fbSdkPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = function () {
      try {
        window.FB.init({
          appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: graphVersion || 'v21.0',
        });
        resolve(window.FB);
      } catch (err) {
        reject(err);
      }
    };

    const existingScript = document.getElementById('facebook-jssdk');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      fbSdkPromise = null;
      reject(new Error('Failed to load Facebook JS SDK'));
    };
    document.body.appendChild(script);
  });

  return fbSdkPromise;
}

export const ConnectChannelsPanel: React.FC = () => {
  const [status, setStatus] = useState<ChannelStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);

  // WhatsApp Embedded Signup states
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [waEmbeddedConfig, setWaEmbeddedConfig] = useState<WaEmbeddedConfig | null>(null);
  const [isWaConfigLoading, setIsWaConfigLoading] = useState(false);
  const [embeddedStep, setEmbeddedStep] = useState<
    'idle' | 'waiting_popup' | 'getting_token' | 'checking_number' | 'registering_number' | 'subscribing_webhook' | 'saving' | 'done' | 'error'
  >('idle');
  const [embeddedStepDetails, setEmbeddedStepDetails] = useState<EmbeddedStepDetail[]>([]);
  const [embeddedError, setEmbeddedError] = useState<string | null>(null);
  const [embeddedWarning, setEmbeddedWarning] = useState<string | null>(null);

  // Manual WhatsApp modal states
  const [isAdvancedManualOpen, setIsAdvancedManualOpen] = useState(false);
  const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
  const [waBusinessAccountId, setWaBusinessAccountId] = useState('');
  const [waAccessToken, setWaAccessToken] = useState('');
  const [waVerifying, setWaVerifying] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);

  // WhatsApp connection testing
  const [testWaLoading, setTestWaLoading] = useState(false);
  const [testWaResult, setTestWaResult] = useState<{ success: boolean; message: string } | null>(null);

  // Multiple pages selection modal if returned
  const [availablePages, setAvailablePages] = useState<FacebookPageOption[] | null>(null);
  const [isInstagramPickMode, setIsInstagramPickMode] = useState(false);

  const getAuthToken = () => {
    return typeof window !== 'undefined' ? localStorage.getItem('vistoosa_auth_token') || '' : '';
  };

  const getHeaders = () => {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const [resStatus, resWaStatus] = await Promise.all([
        fetch('/api/connect/status', { headers: getHeaders() }),
        fetch('/api/whatsapp/status', { headers: getHeaders() }),
      ]);

      let baseStatus: ChannelStatus | null = null;
      if (resStatus.ok) {
        const data = await resStatus.json();
        if (data.success) {
          baseStatus = data;
        }
      }

      if (resWaStatus.ok && baseStatus) {
        const waData = await resWaStatus.json();
        baseStatus.whatsapp = {
          connected: waData.connected,
          phoneNumberId: waData.phoneNumberId || baseStatus.whatsapp.phoneNumberId,
          wabaId: waData.wabaId || baseStatus.whatsapp.wabaId,
          verifiedName: waData.verifiedName || baseStatus.whatsapp.verifiedName,
          displayNumber: waData.displayNumber,
          qualityRating: waData.qualityRating,
          webhookSubscribed: waData.webhookSubscribed,
          tokenExpiresAt: waData.tokenExpiresAt,
        };
      }

      if (baseStatus) {
        setStatus(baseStatus);
      }
    } catch (err: any) {
      console.warn('[ConnectChannelsPanel]: Failed to fetch status', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadWaEmbeddedConfig = useCallback(async () => {
    try {
      setIsWaConfigLoading(true);
      const res = await fetch('/api/whatsapp/embedded-signup/config', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setWaEmbeddedConfig({
            appId: data.appId || '',
            configId: data.configId || '',
            graphVersion: data.graphVersion || 'v21.0',
          });
        }
      }
    } catch (err) {
      console.warn('[ConnectChannelsPanel]: Failed to load embedded config', err);
    } finally {
      setIsWaConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadWaEmbeddedConfig();
  }, [loadStatus, loadWaEmbeddedConfig]);

  // Listen to postMessage from the Facebook Pages OAuth popup
  useEffect(() => {
    const handlePopupMessage = async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      const { type, pageId, pageName, error, pages } = event.data;

      if (type === 'FB_OAUTH_SUCCESS') {
        setSuccessMessage(`Facebook Page "${pageName || pageId}" successfully connected!`);
        setErrorMessage(null);
        setAvailablePages(null);
        loadStatus();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else if (type === 'FB_PAGES_LIST' && Array.isArray(pages) && pages.length > 0) {
        setAvailablePages(pages);
      } else if (type === 'FB_OAUTH_ERROR') {
        setErrorMessage(error || 'Facebook authorization failed or was cancelled.');
        setTimeout(() => setErrorMessage(null), 7000);
      }
    };

    window.addEventListener('message', handlePopupMessage);
    return () => window.removeEventListener('message', handlePopupMessage);
  }, [loadStatus]);

  // Start Facebook OAuth
  const handleConnectFacebook = async () => {
    if (!status?.appConfigured) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setActionLoading('fb-start');

    try {
      const res = await fetch('/api/auth/facebook/start', { headers: getHeaders() });
      const data = await res.json();

      if (!res.ok || !data.success || !data.url) {
        setErrorMessage(data.message || 'Could not initiate Facebook connection. Check App ID/Secret.');
        return;
      }

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.url,
        'FacebookOAuthPopup',
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        setErrorMessage('Popup was blocked by your browser. Please allow popups for this site and try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error while opening Facebook login.');
    } finally {
      setActionLoading(null);
    }
  };

  // Disconnect Facebook
  const handleDisconnectFacebook = async () => {
    if (!window.confirm('Are you sure you want to disconnect this Facebook Page?')) return;
    setActionLoading('fb-disconnect');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/connect/facebook/disconnect', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('Facebook Page disconnected.');
        loadStatus();
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(data.message || 'Failed to disconnect.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error while disconnecting.');
    } finally {
      setActionLoading(null);
    }
  };

  // Connect / Pick Instagram
  const handleConnectInstagram = () => {
    if (!status?.facebook.connected) {
      handleConnectFacebook();
      return;
    }
    setIsInstagramPickMode(true);
    handleConnectFacebook();
  };

  // Disconnect Instagram
  const handleDisconnectInstagram = async () => {
    if (!window.confirm('Disconnect Instagram Professional Account?')) return;
    setActionLoading('ig-disconnect');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/connect/instagram/disconnect', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('Instagram disconnected.');
        loadStatus();
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(data.message || 'Failed to disconnect Instagram.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error disconnecting Instagram.');
    } finally {
      setActionLoading(null);
    }
  };

  // -------------------------------------------------------------------------
  // WHATSAPP EMBEDDED SIGNUP (Phone Number + OTP)
  // -------------------------------------------------------------------------
  const handleStartEmbeddedSignup = async () => {
    if (!waEmbeddedConfig?.appId || !waEmbeddedConfig?.configId) {
      setEmbeddedError('Embedded Signup Configuration ID missing. Add it in Connect Channels.');
      return;
    }

    setEmbeddedStep('waiting_popup');
    setEmbeddedError(null);
    setEmbeddedWarning(null);
    setEmbeddedStepDetails([]);
    setPersistenceWarning(null);

    try {
      await loadFacebookSdk(waEmbeddedConfig.appId, waEmbeddedConfig.graphVersion || 'v21.0');
    } catch (err: any) {
      setEmbeddedStep('error');
      setEmbeddedError(`Could not load Facebook SDK: ${err?.message || err}`);
      return;
    }

    let receivedCode: string | null = null;
    let receivedPhoneId: string | null = null;
    let receivedWabaId: string | null = null;
    let completionTriggered = false;

    const cleanupListener = () => {
      window.removeEventListener('message', messageHandler);
    };

    const triggerCompletion = async (code: string, phoneId: string, wabaId: string) => {
      if (completionTriggered) return;
      completionTriggered = true;
      cleanupListener();

      setEmbeddedStep('getting_token');

      try {
        const res = await fetch('/api/whatsapp/embedded-signup/complete', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            code,
            phoneNumberId: phoneId,
            wabaId: wabaId,
          }),
        });

        const data = await res.json();
        if (Array.isArray(data.steps)) {
          setEmbeddedStepDetails(data.steps);
        }

        if (res.ok && data.success) {
          setEmbeddedStep('done');
          if (data.persisted === false) {
            setPersistenceWarning(
              '⚠️ Warning: WhatsApp connected in memory, but writing to Firestore database failed (Quota limit reached).'
            );
          }
          setSuccessMessage(
            `WhatsApp Cloud API connected successfully as "${data.summary?.verifiedName || 'Business'}"!`
          );
          loadStatus();
          setTimeout(() => setSuccessMessage(null), 5000);
        } else {
          setEmbeddedStep('error');
          setEmbeddedError(data.message || 'WhatsApp Embedded Signup completion failed.');
        }
      } catch (err: any) {
        setEmbeddedStep('error');
        setEmbeddedError(err?.message || 'Network error completing WhatsApp Embedded Signup');
      }
    };

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') {
        return;
      }

      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {}
      }

      if (data && data.type === 'WA_EMBEDDED_SIGNUP') {
        const eventType = data.event;
        if (eventType === 'FINISH') {
          const pId = data.data?.phone_number_id;
          const wId = data.data?.waba_id;
          if (pId && wId) {
            receivedPhoneId = String(pId);
            receivedWabaId = String(wId);
            if (receivedCode) {
              triggerCompletion(receivedCode, receivedPhoneId, receivedWabaId);
            }
          }
        } else if (eventType === 'FINISH_ONLY_WABA') {
          setEmbeddedWarning(
            '⚠️ Meta completed WABA setup, but no phone number was registered. Please add a phone number in the Meta flow.'
          );
        } else if (eventType === 'CANCEL') {
          cleanupListener();
          setEmbeddedStep('error');
          setEmbeddedError(`Cancelled at step: ${data.data?.current_step || 'unknown'}`);
        } else if (eventType === 'ERROR') {
          cleanupListener();
          setEmbeddedStep('error');
          setEmbeddedError(data.data?.error_message || 'Meta Embedded Signup popup encountered an error');
        }
      }
    };

    window.addEventListener('message', messageHandler);

    try {
      window.FB.login(
        (response: any) => {
          if (response.authResponse?.code) {
            receivedCode = response.authResponse.code;
            if (receivedPhoneId && receivedWabaId) {
              triggerCompletion(receivedCode, receivedPhoneId, receivedWabaId);
            }
          } else {
            setTimeout(() => {
              if (!completionTriggered && !receivedPhoneId) {
                cleanupListener();
                setEmbeddedStep('error');
                setEmbeddedError('Meta login popup was closed without completing authorization.');
              }
            }, 1200);
          }
        },
        {
          config_id: waEmbeddedConfig.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: '',
            sessionInfoVersion: '3',
          },
        }
      );
    } catch (err: any) {
      cleanupListener();
      setEmbeddedStep('error');
      setEmbeddedError(err?.message || 'Failed to trigger Facebook login dialog');
    }
  };

  // Test WhatsApp Connection
  const handleTestWhatsApp = async () => {
    setTestWaLoading(true);
    setTestWaResult(null);
    try {
      const res = await fetch('/api/settings/meta-order/test-connection', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const waCheck = data.results?.checks?.whatsapp;
      if (waCheck && waCheck.status === 'ok') {
        setTestWaResult({
          success: true,
          message: waCheck.message || 'WhatsApp Cloud API connection test passed!',
        });
      } else {
        setTestWaResult({
          success: false,
          message: waCheck?.message || data.message || 'WhatsApp connection test failed.',
        });
      }
    } catch (err: any) {
      setTestWaResult({
        success: false,
        message: err?.message || 'Network error running WhatsApp test',
      });
    } finally {
      setTestWaLoading(false);
    }
  };

  // Manual Verify and Save WhatsApp
  const handleVerifyWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaVerifying(true);
    setWaError(null);

    try {
      const res = await fetch('/api/connect/whatsapp/verify-and-save', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          whatsappPhoneNumberId: waPhoneNumberId.trim(),
          whatsappBusinessAccountId: waBusinessAccountId.trim(),
          whatsappAccessToken: waAccessToken.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.persisted === false) {
          setPersistenceWarning('⚠️ Warning: Saved in memory, but Firestore database persistence failed.');
        }
        setSuccessMessage(data.message || 'WhatsApp Cloud API connected successfully!');
        setIsWaModalOpen(false);
        setWaAccessToken('');
        loadStatus();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setWaError(data.message || 'Verification failed. Please verify credentials.');
      }
    } catch (err: any) {
      setWaError(err?.message || 'Network error during WhatsApp verification.');
    } finally {
      setWaVerifying(false);
    }
  };

  // Disconnect WhatsApp
  const handleDisconnectWhatsapp = async () => {
    if (!window.confirm('Disconnect WhatsApp Cloud API integration?')) return;
    setActionLoading('wa-disconnect');

    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.persisted === false) {
          setPersistenceWarning('Warning: Disconnected in memory, but Firestore database write limit was reached.');
        }
        setSuccessMessage('WhatsApp disconnected successfully.');
        setIsWaModalOpen(false);
        loadStatus();
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(data.message || 'Failed to disconnect WhatsApp.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error disconnecting WhatsApp.');
    } finally {
      setActionLoading(null);
    }
  };

  // Select a specific Page from availablePages modal
  const handleSelectPage = async (page: FacebookPageOption) => {
    setActionLoading(`select-${page.id}`);
    try {
      const res = await fetch('/api/connect/facebook/select', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.accessToken,
          igBusinessAccountId: page.igBusinessAccountId,
          igUsername: page.igUsername,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`Connected Page "${page.name}"!`);
        setAvailablePages(null);
        loadStatus();
      } else {
        setErrorMessage(data.message || 'Failed to connect page.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error connecting page.');
    } finally {
      setActionLoading(null);
    }
  };

  const isConfigured = Boolean(status?.appConfigured);
  const canConnect = status?.isOwner !== false;
  const hasEmbeddedConfig = Boolean(waEmbeddedConfig?.appId && waEmbeddedConfig?.configId);

  return (
    <div className="space-y-3">
      {/* Messages */}
      {errorMessage && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {persistenceWarning && (
        <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{persistenceWarning}</span>
          </div>
          <button
            onClick={() => setPersistenceWarning(null)}
            className="text-amber-400 hover:text-amber-200 text-xs font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Bar: 3 Channel Cards */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-zinc-800/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Connect your channels</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
                  Meta Multi-Channel
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Connect Facebook, Instagram & WhatsApp to receive chats & automated orders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadStatus();
                loadWaEmbeddedConfig();
              }}
              disabled={isLoading}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition flex items-center gap-1.5"
              title="Refresh connection status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
              <span className="text-[11px] hidden sm:inline">Refresh Status</span>
            </button>
          </div>
        </div>

        {/* 3 Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Facebook Page */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              status?.facebook.connected
                ? 'bg-blue-950/20 border-blue-500/40 shadow-sm shadow-blue-950/30'
                : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/40">
                  <Share2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Facebook Page</h4>
                  <p className="text-[10px] text-zinc-400 font-mono">Messenger Direct</p>
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border ${
                  status?.facebook.connected
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
                }`}
              >
                {status?.facebook.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            <div className="min-h-[44px] flex flex-col justify-center mb-3">
              {status?.facebook.connected ? (
                <div>
                  <p className="text-xs font-semibold text-emerald-300 truncate">
                    Connected as {status.facebook.pageName || status.facebook.pageId}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono truncate">ID: {status.facebook.pageId}</p>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-400">
                  Login with Facebook to link your Page for receiving and replying to customer messages.
                </p>
              )}
            </div>

            {status?.facebook.connected ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDisconnectFacebook}
                  disabled={actionLoading === 'fb-disconnect' || !canConnect}
                  className="w-full py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Unlink className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectFacebook}
                disabled={!isConfigured || actionLoading === 'fb-start' || !canConnect}
                title={!isConfigured ? 'Set Meta App ID & Secret in Settings > Connect Channels first' : ''}
                className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm ${
                  !isConfigured || !canConnect
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/60'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 cursor-pointer active:scale-[0.98]'
                }`}
              >
                {actionLoading === 'fb-start' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )}
                <span>Connect Facebook Page</span>
              </button>
            )}
          </div>

          {/* Card 2: Instagram */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              status?.instagram.connected
                ? 'bg-gradient-to-br from-fuchsia-950/20 to-pink-950/20 border-fuchsia-500/40 shadow-sm'
                : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
                  <Instagram className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Instagram Account</h4>
                  <p className="text-[10px] text-zinc-400 font-mono">Instagram Direct</p>
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border ${
                  status?.instagram.connected
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
                }`}
              >
                {status?.instagram.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            <div className="min-h-[44px] flex flex-col justify-center mb-3">
              {status?.instagram.connected ? (
                <div>
                  <p className="text-xs font-semibold text-fuchsia-300 truncate">
                    Connected as {status.instagram.username ? `@${status.instagram.username}` : 'Instagram Professional'}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono truncate">
                    ID: {status.instagram.instagramBusinessAccountId}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-400">
                  Connect your Instagram Professional / Creator account linked with your Facebook Page.
                </p>
              )}
            </div>

            {status?.instagram.connected ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDisconnectInstagram}
                  disabled={actionLoading === 'ig-disconnect' || !canConnect}
                  className="w-full py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Unlink className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectInstagram}
                disabled={!isConfigured || !canConnect}
                title={!isConfigured ? 'Set Meta App ID & Secret in Settings > Connect Channels first' : ''}
                className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm ${
                  !isConfigured || !canConnect
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/60'
                    : 'bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white shadow-fuchsia-900/30 cursor-pointer active:scale-[0.98]'
                }`}
              >
                <Instagram className="w-3.5 h-3.5" />
                <span>Connect Instagram</span>
              </button>
            )}
          </div>

          {/* Card 3: WhatsApp Cloud API */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              status?.whatsapp.connected
                ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-600/40">
                  <MessageCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">WhatsApp Cloud API</h4>
                  <p className="text-[10px] text-zinc-400 font-mono">Phone + OTP Embedded</p>
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono border ${
                  status?.whatsapp.connected
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700/60'
                }`}
              >
                {status?.whatsapp.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            <div className="min-h-[44px] flex flex-col justify-center mb-3">
              {status?.whatsapp.connected ? (
                <div>
                  <p className="text-xs font-semibold text-emerald-300 truncate">
                    {status.whatsapp.verifiedName || 'WhatsApp Cloud API'}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono truncate">
                    {status.whatsapp.displayNumber || status.whatsapp.phoneNumberId}
                    {status.whatsapp.qualityRating && ` • Quality: ${status.whatsapp.qualityRating}`}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-400">
                  Embedded Signup: Login with Facebook, enter phone number & verify with OTP directly.
                </p>
              )}
            </div>

            {status?.whatsapp.connected ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsWaModalOpen(true)}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1 transition"
                >
                  <Info className="w-3 h-3 text-emerald-400" />
                  <span>View Details</span>
                </button>
                <button
                  onClick={handleDisconnectWhatsapp}
                  disabled={actionLoading === 'wa-disconnect' || !canConnect}
                  className="py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Unlink className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEmbeddedStep('idle');
                  setEmbeddedError(null);
                  setEmbeddedStepDetails([]);
                  setIsWaModalOpen(true);
                }}
                disabled={!canConnect}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm shadow-emerald-900/20 active:scale-[0.98]"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Connect WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info & Mode Banner */}
      {!isConfigured ? (
        <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2 font-medium">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Setup Notice:</strong> Set App ID and App Secret in <strong>Settings &gt; Connect Channels</strong> first to enable Meta channel connections.
          </span>
        </div>
      ) : (
        <div className="p-2.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-zinc-400 text-[10px] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>
            While the Meta app is in Development mode, only people with a role on the Meta app (Admin/Developer/Tester) can connect a Page or WhatsApp number.
          </span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: WHATSAPP CLOUD API CONNECT & EMBEDDED SIGNUP MODAL          */}
      {/* ==================================================================== */}
      {isWaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-zinc-800 bg-zinc-950 text-white space-y-4 shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <MessageCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Connect WhatsApp Cloud API</h3>
              </div>
              <button
                onClick={() => setIsWaModalOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CASE A: ALREADY CONNECTED -> SUCCESS CARD */}
            {status?.whatsapp.connected ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-white">
                        {status.whatsapp.verifiedName || 'WhatsApp Business'}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      Connected &amp; Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">Display Number:</span>
                      <span className="font-mono text-zinc-200 font-semibold">
                        {status.whatsapp.displayNumber || status.whatsapp.phoneNumberId || 'Configured'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block">Quality Rating:</span>
                      <span className="font-bold text-emerald-400">
                        {status.whatsapp.qualityRating || 'GREEN (Good)'}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1">
                    <span>
                      Webhook Status:{' '}
                      <strong className={status.whatsapp.webhookSubscribed ? 'text-emerald-400' : 'text-zinc-300'}>
                        {status.whatsapp.webhookSubscribed ? 'Subscribed' : 'Active'}
                      </strong>
                    </span>
                    {status.whatsapp.tokenExpiresAt ? (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Expires: {new Date(status.whatsapp.tokenExpiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-mono">Never Expiring Token</span>
                    )}
                  </div>
                </div>

                {testWaResult && (
                  <div
                    className={`p-3 rounded-2xl border text-xs flex items-center gap-2 ${
                      testWaResult.success
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    {testWaResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{testWaResult.message}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={handleTestWhatsApp}
                    disabled={testWaLoading}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${testWaLoading ? 'animate-spin' : ''}`} />
                    <span>{testWaLoading ? 'Testing Graph API...' : 'Test Connection'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnectWhatsapp}
                    disabled={actionLoading === 'wa-disconnect' || !canConnect}
                    className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Disconnect WhatsApp</span>
                  </button>
                </div>
              </div>
            ) : (
              /* CASE B: NOT CONNECTED -> EMBEDDED SIGNUP + ADVANCED MANUAL */
              <div className="space-y-4 text-xs">
                {/* 1. Big Primary Embedded Signup Button */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-950 border border-emerald-500/30 space-y-3">
                  <button
                    type="button"
                    onClick={handleStartEmbeddedSignup}
                    disabled={!hasEmbeddedConfig || isWaConfigLoading || embeddedStep === 'waiting_popup' || embeddedStep === 'getting_token'}
                    className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg ${
                      !hasEmbeddedConfig
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/60'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-900/40 cursor-pointer active:scale-[0.98]'
                    }`}
                  >
                    {embeddedStep === 'waiting_popup' || embeddedStep === 'getting_token' ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                    <span>Connect with Phone Number + OTP (Recommended)</span>
                  </button>

                  <p className="text-[11px] text-zinc-300 text-center leading-relaxed">
                    Facebook/Meta popup এ লগইন করুন, WhatsApp নম্বর দিন, OTP দিয়ে ভেরিফাই করুন। টোকেন বা আইডি কপি করতে হবে না।
                  </p>

                  {!hasEmbeddedConfig && !isWaConfigLoading && (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span>Embedded Signup Configuration ID missing. </span>
                        <a
                          href="#integrations"
                          onClick={() => setIsWaModalOpen(false)}
                          className="font-bold underline text-amber-300 hover:text-white"
                        >
                          Add it in Connect Channels.
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Steps / Live Results */}
                {embeddedStep !== 'idle' && (
                  <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2.5 animate-in fade-in">
                    <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider block">
                      Connection Progress:
                    </span>

                    <div className="space-y-1.5 text-xs">
                      {/* Step 1: Meta Popup */}
                      <div className="flex items-center gap-2">
                        {embeddedStep === 'waiting_popup' ? (
                          <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        ) : embeddedStep !== 'idle' && embeddedStep !== 'error' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-zinc-700" />
                        )}
                        <span className={embeddedStep === 'waiting_popup' ? 'text-blue-300 font-bold' : 'text-zinc-300'}>
                          Waiting for Meta popup (মেটা পপআপে লগইন ও ওটিপি যাচাই)...
                        </span>
                      </div>

                      {/* Returned backend steps */}
                      {embeddedStepDetails.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2 pl-1">
                          {s.ok ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span className={s.ok ? 'text-zinc-300' : 'text-rose-300 font-medium'}>
                            {s.name}: {s.detail || s.error || (s.ok ? 'OK' : 'Failed')}
                          </span>
                        </div>
                      ))}

                      {embeddedStep === 'done' && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Done! WhatsApp Cloud API is connected.</span>
                        </div>
                      )}
                    </div>

                    {/* Step Error Details & Retry */}
                    {embeddedError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-[11px] space-y-2">
                        <p>{embeddedError}</p>
                        <button
                          type="button"
                          onClick={handleStartEmbeddedSignup}
                          className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry (পুনরায় চেষ্টা করুন)</span>
                        </button>
                      </div>
                    )}

                    {embeddedWarning && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px]">
                        {embeddedWarning}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Collapsible Manual Form Section */}
                <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/30">
                  <button
                    type="button"
                    onClick={() => setIsAdvancedManualOpen(!isAdvancedManualOpen)}
                    className="w-full px-4 py-3 flex items-center justify-between text-zinc-300 hover:text-white font-semibold text-xs transition cursor-pointer"
                  >
                    <span>Advanced: enter IDs manually (ম্যানুয়াল কনফিগারেশন)</span>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 transition-transform ${
                        isAdvancedManualOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isAdvancedManualOpen && (
                    <form onSubmit={handleVerifyWhatsapp} className="p-4 pt-1 space-y-3.5 border-t border-zinc-800">
                      <p className="text-[11px] text-zinc-400">
                        Enter your official WhatsApp Cloud API details from Meta Business Developers:
                      </p>

                      {waError && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
                          {waError}
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-zinc-300 font-semibold">Phone Number ID *</label>
                        <input
                          type="text"
                          required
                          value={waPhoneNumberId}
                          onChange={(e) => setWaPhoneNumberId(e.target.value)}
                          placeholder="e.g. 108492019482019"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-zinc-300 font-semibold">WhatsApp Business Account ID (WABA)</label>
                        <input
                          type="text"
                          value={waBusinessAccountId}
                          onChange={(e) => setWaBusinessAccountId(e.target.value)}
                          placeholder="e.g. 52910481029"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-zinc-300 font-semibold">Permanent Access Token *</label>
                        <input
                          type="password"
                          required
                          value={waAccessToken}
                          onChange={(e) => setWaAccessToken(e.target.value)}
                          placeholder="EAAB... (System User Permanent Token)"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setIsAdvancedManualOpen(false)}
                          className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs cursor-pointer"
                        >
                          Close
                        </button>
                        <button
                          type="submit"
                          disabled={waVerifying}
                          className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-900/30 cursor-pointer"
                        >
                          {waVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>{waVerifying ? 'Verifying with Meta...' : 'Verify & Connect'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* 3. Small note as required */}
                <p className="text-[10px] text-zinc-500 leading-relaxed bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
                  Note: A phone number can be registered on WhatsApp Cloud API only a limited number of times per week. If the number is currently on normal WhatsApp, remove that WhatsApp account first before connecting.
                  <br />
                  <span className="text-zinc-400">
                    (একটি ফোন নম্বর সপ্তাহে সীমিত সংখ্যক বার ক্লাউড এপিআইতে রেজিস্টার করা যায়। নম্বরটি সাধারণ হোয়াটসঅ্যাপে সক্রিয় থাকলে প্রথমে একাউন্ট ডিলিট করুন)।
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: CHOOSE PAGE MODAL (IF MULTIPLE PAGES FOUND)                 */}
      {/* ==================================================================== */}
      {availablePages && availablePages.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-zinc-800 bg-zinc-950 text-white space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Select Your Facebook Page</span>
              </h3>
              <button
                onClick={() => setAvailablePages(null)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Pick the Facebook Page to connect for automated ordering:
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {availablePages.map((page) => (
                <div
                  key={page.id}
                  className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition"
                >
                  <div className="text-left">
                    <p className="text-xs font-bold text-white">{page.name}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      ID: {page.id} {page.igUsername ? `• Instagram: @${page.igUsername}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSelectPage(page)}
                    disabled={actionLoading === `select-${page.id}`}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
                  >
                    {actionLoading === `select-${page.id}` ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Connect</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
