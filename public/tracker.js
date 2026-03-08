/**
 * Website Tracker - Production Client Script
 * Tracks: Visitors, Location, Device, Traffic Source, Leads
 * @version 2.0.0
 */
(function() {
  'use strict';

  // Bot detection
  const userAgent = navigator.userAgent.toLowerCase();
  const botPatterns = ['bot', 'crawler', 'spider', 'googlebot', 'bingbot', 'slurp', 'duckduckbot'];
  const isBot = botPatterns.some(pattern => userAgent.includes(pattern));

  if (isBot) return;

  // Get API key and endpoint from script tag
  const scriptTag = document.currentScript || document.querySelector('script[data-api-key]');
  const apiKey = scriptTag ? scriptTag.getAttribute('data-api-key') : null;

  // Auto-detect API endpoint from script source URL
  let apiEndpoint;
  if (scriptTag && scriptTag.src) {
    // Extract the base URL from tracker.js source (e.g., https://api.example.com/tracker.js -> https://api.example.com)
    const scriptUrl = new URL(scriptTag.src);
    apiEndpoint = `${scriptUrl.protocol}//${scriptUrl.host}/api/v1/events/log`;
  } else if (scriptTag && scriptTag.getAttribute('data-endpoint')) {
    // Fallback to manual endpoint if specified
    apiEndpoint = scriptTag.getAttribute('data-endpoint');
  } else {
    // Last resort fallback
    apiEndpoint = 'http://localhost:5000/api/v1/events/log';
  }

  if (!apiKey) {
    console.error('[Tracker] Error: API key not found in script tag');
    return;
  }

  console.log('[Tracker] Script loaded successfully');
  console.log('[Tracker] API Key:', apiKey.substring(0, 10) + '...');
  console.log('[Tracker] API Endpoint:', apiEndpoint);

  /**
   * Check if this is a new visitor session
   * Uses sessionStorage so each new browser session counts as new visitor
   * This way: open site = +1 visitor, close and reopen = +1 visitor again
   * Session persists through page refreshes but not tab close/reopen
   */
  function isNewVisitorSession() {
    const SESSION_KEY = '_wt_session_tracked';
    const SESSION_TIMESTAMP_KEY = '_wt_session_timestamp';

    const sessionTracked = sessionStorage.getItem(SESSION_KEY);
    const sessionTimestamp = sessionStorage.getItem(SESSION_TIMESTAMP_KEY);
    const currentTimestamp = Date.now().toString();

    if (!sessionTracked) {
      // New session - mark it as tracked with timestamp
      sessionStorage.setItem(SESSION_KEY, 'true');
      sessionStorage.setItem(SESSION_TIMESTAMP_KEY, currentTimestamp);
      return true;
    }

    // Session already tracked - this is a refresh, not a new visit
    return false;
  }

  /**
   * Detect device type from user agent
   * Returns ONLY: desktop, mobile, or tablet
   */
  function getDeviceType() {
    const ua = navigator.userAgent;

    // Tablet detection
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }

    // Mobile detection
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }

    // Default to desktop
    return 'desktop';
  }

  /**
   * Detect traffic source from referrer
   * Returns ONLY: Google, Facebook, Instagram, YouTube, Direct, or Other
   */
  function getTrafficSource() {
    const referrer = document.referrer.toLowerCase();

    if (!referrer) return 'Direct';

    if (referrer.includes('google')) return 'Google';
    if (referrer.includes('facebook') || referrer.includes('fb.com')) return 'Facebook';
    if (referrer.includes('instagram')) return 'Instagram';
    if (referrer.includes('youtube') || referrer.includes('youtu.be')) return 'YouTube';

    return 'Other';
  }

  /**
   * Send event to backend using fetch
   */
  function sendEvent(eventData) {
    // Build payload with only serializable data
    const payload = {
      apiKey: apiKey,
      eventType: eventData.eventType,
      url: window.location.href,
      referrer: document.referrer || undefined,
      device: getDeviceType(),
      source: getTrafficSource(),
      // Send isNewVisitor ONLY for initial visitor tracking
      // Backend will use IP address to identify unique visitors
      isNewVisitor: eventData.isNewVisitor || false,
      timestamp: new Date().toISOString()
    };

    // Safely add event data (only primitive values, no DOM elements)
    if (eventData.data && typeof eventData.data === 'object') {
      try {
        for (const key in eventData.data) {
          if (eventData.data.hasOwnProperty(key)) {
            const value = eventData.data[key];
            // Only add primitive values (string, number, boolean)
            // Skip objects, arrays, DOM elements, React fiber nodes, and null
            if (value !== null && value !== undefined &&
                (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
              payload[key] = value;
            }
          }
        }
      } catch (error) {
        console.warn('[Tracker] Error processing event data:', error);
      }
    }

    // Use fetch API for real-time tracking
    fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    })
    .then(response => {
      if (response.ok) {
        console.log('Event tracked successfully');
      } else {
        console.error('Tracking error');
      }
    })
    .catch(error => {
      console.error('Tracking error:', error);
    });
  }

  /**
   * Track visitor (once per session)
   * This is called on page load to register the visitor
   * IP-based tracking happens on backend
   */
  let visitorTracked = false;
  function trackVisitor() {
    // Only track visitor once per page load
    if (visitorTracked) {
      console.log('[Tracker] Visitor already tracked in this page load');
      return;
    }

    visitorTracked = true;
    const isNewSession = isNewVisitorSession();

    console.log('[Tracker] Visitor session check:', {
      isNewSession: isNewSession,
      willTrack: isNewSession
    });

    // Only send visitor event if this is truly a new session
    // This prevents counting the same visitor multiple times on page refresh
    if (isNewSession) {
      console.log('[Tracker] New session detected - tracking visitor');
      // Send visitor event (backend will use IP to identify unique visitors)
      sendEvent({
        eventType: 'visitor',
        isNewVisitor: true,
        data: {}
      });
    } else {
      console.log('[Tracker] Existing session - visitor not tracked (already counted)');
    }
  }

  /**
   * Track tel: link clicks
   */
  function trackTelClick(phoneNumber) {
    sendEvent({
      eventType: 'tel_click',
      data: { phoneNumber }
    });
  }

  /**
   * Track WhatsApp clicks (wa.me links)
   */
  function trackWhatsAppClick(phoneNumber) {
    sendEvent({
      eventType: 'whatsapp_click',
      data: { phoneNumber }
    });
  }

  /**
   * Track .track-cta button clicks
   */
  function trackCtaClick(ctaId, ctaText) {
    sendEvent({
      eventType: 'cta_click',
      data: {
        ctaId: ctaId || 'unknown',
        ctaText: ctaText || 'unknown'
      }
    });
  }

  /**
   * Track form submissions
   * @param {string|HTMLFormElement|Event} formIdOrEvent - Form ID, form element, or React event
   */
  function trackFormSubmit(formIdOrEvent) {
    let formId = 'unknown';

    // Handle different input types safely
    try {
      if (typeof formIdOrEvent === 'string') {
        // Direct string ID
        formId = formIdOrEvent;
      } else if (formIdOrEvent && formIdOrEvent.target) {
        // React synthetic event or native event
        const form = formIdOrEvent.target.closest ?
          formIdOrEvent.target.closest('form') :
          formIdOrEvent.target;

        if (form) {
          formId = form.id || form.name || form.className || 'unknown';
        }
      } else if (formIdOrEvent && formIdOrEvent.tagName === 'FORM') {
        // Direct form element
        formId = formIdOrEvent.id || formIdOrEvent.name || formIdOrEvent.className || 'unknown';
      }
    } catch (error) {
      console.warn('[Tracker] Error extracting form ID:', error);
    }

    sendEvent({
      eventType: 'form_submit',
      data: { formId: String(formId) }
    });
  }

  /**
   * Setup event listeners
   */
  function setupListeners() {
    // Track clicks
    document.addEventListener('click', function(e) {
      // Tel: link clicks
      const telTarget = e.target.closest('a[href^="tel:"]');
      if (telTarget) {
        const phoneNumber = telTarget.getAttribute('href').replace('tel:', '');
        trackTelClick(phoneNumber);
        return;
      }

      // WhatsApp (wa.me) links
      const waTarget = e.target.closest('a[href*="wa.me"]');
      if (waTarget) {
        const href = waTarget.getAttribute('href');
        const phoneMatch = href.match(/wa\.me\/(\d+)/);
        const phoneNumber = phoneMatch ? phoneMatch[1] : 'unknown';
        trackWhatsAppClick(phoneNumber);
        return;
      }

      // .track-cta button clicks
      const ctaTarget = e.target.closest('.track-cta');
      if (ctaTarget) {
        const ctaId = ctaTarget.id || ctaTarget.getAttribute('data-cta-id');
        const ctaText = ctaTarget.textContent?.trim() || ctaTarget.getAttribute('aria-label');
        trackCtaClick(ctaId, ctaText);
        return;
      }

    }, true);

    // Track form submissions (Works for both HTML & React forms)
    // We track on submit button click because React often prevents default submit event
    const trackedForms = new WeakSet(); // Prevent duplicate tracking

    // Method 1: Track submit button clicks (for React/SPA forms)
    document.addEventListener('click', function(e) {
      const submitButton = e.target.closest('button[type="submit"], input[type="submit"]');
      if (submitButton) {
        const form = submitButton.closest('form');
        if (form && !trackedForms.has(form)) {
          trackedForms.add(form);
          const formId = form.id || form.name || form.className || 'unknown';

          // Track immediately for React forms (they prevent default submit)
          trackFormSubmit(formId);

          // Reset after 2 seconds to allow re-submission tracking
          setTimeout(() => trackedForms.delete(form), 2000);
        }
      }
    }, true);

    // Method 2: Track traditional form submissions (HTML forms - backup)
    document.addEventListener('submit', function(e) {
      const form = e.target;
      if (form.tagName === 'FORM' && !trackedForms.has(form)) {
        trackedForms.add(form);
        const formId = form.id || form.name || form.className || 'unknown';
        trackFormSubmit(formId);

        // Reset after 2 seconds
        setTimeout(() => trackedForms.delete(form), 2000);
      }
    }, true);
  }

  /**
   * Initialize tracker
   */
  function init() {
    // Track visitor (IP-based on backend)
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      trackVisitor();
    } else {
      document.addEventListener('DOMContentLoaded', trackVisitor);
    }

    // Setup event listeners for clicks, forms, etc.
    setupListeners();
  }

  // Start tracking
  init();

  // Expose tracking functions globally for React/SPA usage
  window.WebsiteTracker = {
    trackFormSubmit: trackFormSubmit,
    trackCtaClick: trackCtaClick,
    trackTelClick: trackTelClick,
    trackWhatsAppClick: trackWhatsAppClick,
    sendEvent: sendEvent
  };

})();
