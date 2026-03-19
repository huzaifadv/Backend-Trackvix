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

    // Log the payload being sent for debugging
    console.log('[Tracker] Sending event:', {
      eventType: payload.eventType,
      formId: payload.formId,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      fieldCount: Object.keys(payload).length
    });

    // Use fetch with keepalive for reliable delivery
    fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true // Ensures request completes even if page unloads
    })
    .then(response => {
      if (response.ok) {
        console.log('[Tracker] Event tracked successfully');
        return response.json();
      } else {
        console.error('[Tracker] Tracking error - status:', response.status);
      }
    })
    .then(data => {
      if (data) {
        console.log('[Tracker] Server response:', data);
      }
    })
    .catch(error => {
      console.error('[Tracker] Tracking error:', error);
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

  // Global flag to prevent simultaneous duplicate submissions
  let _isCurrentlyTracking = false;
  let _lastTrackingTimestamp = 0;

  /**
   * Track form submissions with automatic data extraction
   * @param {string|HTMLFormElement|Event|Object} formIdOrEvent - Form ID, form element, React event, or manual data object
   */
  function trackFormSubmit(formIdOrEvent) {
    // ✅ SYNCHRONOUS DUPLICATE PREVENTION - Block if already tracking
    const now = Date.now();
    if (_isCurrentlyTracking || (now - _lastTrackingTimestamp) < 100) {
      console.log('[Tracker] ⛔ Duplicate blocked - already tracking a submission (sync protection)');
      return;
    }

    _isCurrentlyTracking = true;
    _lastTrackingTimestamp = now;

    let formId = 'Contact Form';
    let formData = {};
    let isManualCall = false;

    try {
      // Case 1: Manual data object (for React Hook Form or custom tracking)
      // Check if this is a plain object with form data (not an Event object or HTMLFormElement)
      if (formIdOrEvent && typeof formIdOrEvent === 'object' &&
          !formIdOrEvent.target && !formIdOrEvent.preventDefault &&
          formIdOrEvent.tagName !== 'FORM' && // ✅ Exclude HTMLFormElement
          !formIdOrEvent.elements && // ✅ Exclude form elements collection
          (formIdOrEvent.name || formIdOrEvent.email || formIdOrEvent.phone || formIdOrEvent.message)) {
        // Direct data object - capture ALL fields
        isManualCall = true;
        for (const key in formIdOrEvent) {
          if (formIdOrEvent.hasOwnProperty(key) && key !== 'formId' && key !== 'formName') {
            const value = formIdOrEvent[key];
            // Only include non-empty strings, numbers, and booleans
            if (value !== null && value !== undefined && value !== '') {
              formData[key] = value;
            }
          }
        }
        formId = formIdOrEvent.formId || formIdOrEvent.formName || 'Contact Form';

        console.log('[Tracker] Form data from object (manual call):', {
          formId,
          fields: Object.keys(formData),
          fieldCount: Object.keys(formData).length
        });
      }
      // Case 2: Extract from form element
      else {
        let form = null;

        if (typeof formIdOrEvent === 'string') {
          // Direct string ID - try to find form
          form = document.getElementById(formIdOrEvent) || document.querySelector(`form[name="${formIdOrEvent}"]`);
        } else if (formIdOrEvent && formIdOrEvent.target) {
          // React synthetic event or native event
          form = formIdOrEvent.target.closest ?
            formIdOrEvent.target.closest('form') :
            formIdOrEvent.target;
        } else if (formIdOrEvent && formIdOrEvent.tagName === 'FORM') {
          // Direct form element
          form = formIdOrEvent;
        }

        if (form) {
          // Extract form identifier
          formId = form.id || form.name || form.getAttribute('data-form-name') || 'Contact Form';

          // AUTO-EXTRACT ALL FORM DATA
          const formElements = form.elements;

          for (let i = 0; i < formElements.length; i++) {
            const field = formElements[i];
            const fieldName = field.name || field.id;
            const fieldValue = field.value ? field.value.trim() : '';

            // Skip empty fields, buttons, submit elements, and fields without names
            if (!fieldName || !fieldValue || field.type === 'submit' || field.type === 'button' || field.type === 'reset') {
              continue;
            }

            // Skip password and file input fields for security
            if (field.type === 'password' || field.type === 'file') {
              continue;
            }

            // Capture the field (use original name/id, not lowercase)
            formData[fieldName] = fieldValue;
          }

          console.log('[Tracker] Form data extracted from elements:', {
            formId,
            fields: Object.keys(formData),
            fieldCount: Object.keys(formData).length
          });
        }
      }
    } catch (error) {
      console.warn('[Tracker] Error extracting form data:', error);
    }

    // ✅ Validate: Don't send if no data captured
    if (Object.keys(formData).length === 0) {
      console.log('[Tracker] Form submit skipped - no data captured');
      return;
    }

    // ✅ Create unique tracking key for duplicate prevention
    const trackingKey = `${formId}_${JSON.stringify(formData)}`;
    const now = Date.now();

    // Check if this exact submission was already tracked recently
    if (window._formTrackingCache) {
      const lastTracked = window._formTrackingCache.get(trackingKey);
      if (lastTracked && (now - lastTracked) < 2000) { // 2 second window
        console.log('[Tracker] Duplicate form submission prevented (same data within 2s)');
        return;
      }
    } else {
      window._formTrackingCache = new Map();
    }

    // Mark this submission as tracked
    window._formTrackingCache.set(trackingKey, now);

    // Clean up old entries (keep only last 10 submissions)
    if (window._formTrackingCache.size > 10) {
      const entries = Array.from(window._formTrackingCache.entries());
      entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp, newest first
      window._formTrackingCache = new Map(entries.slice(0, 10));
    }

    // Send event with ALL extracted form data
    sendEvent({
      eventType: 'form_submit',
      data: {
        formId: String(formId),
        formName: String(formId),
        ...formData  // ✅ Include ALL form fields
      }
    });

    // ✅ Reset tracking flag after a short delay to allow this submission to complete
    setTimeout(() => {
      _isCurrentlyTracking = false;
    }, 200);
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
    // Use Map to store timestamp AND hash of last tracking to prevent duplicates
    const formTrackingCache = new WeakMap();
    const DUPLICATE_THRESHOLD = 1000; // 1 second - prevent duplicates within this window

    /**
     * Generate a simple hash of form data to detect identical submissions
     */
    function getFormDataHash(form) {
      if (!form || !form.elements) return '';

      const values = [];
      for (let i = 0; i < form.elements.length; i++) {
        const field = form.elements[i];
        if (field.name && field.value && field.type !== 'submit' && field.type !== 'button') {
          values.push(`${field.name}:${field.value}`);
        }
      }
      return values.join('|');
    }

    /**
     * Check if form submission is duplicate
     */
    function isDuplicateSubmission(form) {
      const now = Date.now();
      const cache = formTrackingCache.get(form);

      if (!cache) {
        return false; // First submission
      }

      const timeDiff = now - cache.timestamp;
      const dataHash = getFormDataHash(form);

      // Duplicate if:
      // 1. Submitted within 1 second AND same data
      // OR
      // 2. Submitted within 500ms (React Strict Mode double-render protection)
      if (timeDiff < 500) {
        console.log('[Tracker] Duplicate prevented - React Strict Mode double-render detected');
        return true;
      }

      if (timeDiff < DUPLICATE_THRESHOLD && dataHash === cache.dataHash) {
        console.log('[Tracker] Duplicate prevented - same form data within threshold');
        return true;
      }

      return false;
    }

    /**
     * Mark form as tracked
     */
    function markFormTracked(form) {
      formTrackingCache.set(form, {
        timestamp: Date.now(),
        dataHash: getFormDataHash(form)
      });
    }

    // Method 2: Track traditional form submissions (HTML forms - PRIMARY METHOD)
    // This fires BEFORE page navigation, ensuring data capture
    document.addEventListener('submit', function(e) {
      const form = e.target;
      if (form.tagName === 'FORM' && !form.hasAttribute('data-no-track')) {

        // Check for duplicate (protects against double-submit)
        if (isDuplicateSubmission(form)) {
          console.log('[Tracker] Duplicate form submission prevented (WeakMap protection)');
          return;
        }

        console.log('[Tracker] Form submit event detected - tracking via auto-listener');

        // ✅ CAPTURE FORM DATA IMMEDIATELY (before any navigation)
        trackFormSubmit(form);

        // Mark as tracked AFTER sending (prevents race condition)
        markFormTracked(form);

        // ✅ Don't prevent default - let form submit naturally
        // Form data already captured above
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
