# PWA Setup and Testing Guide

## Overview

The BellSkill app has been configured as a Progressive Web App (PWA) with the following features:

### ✅ What's Been Implemented

1. **Web App Manifest** (`/public/manifest.json`)

   - `display: "standalone"` - Hides browser UI when launched from home screen
   - App icons for different sizes
   - Theme colors and background color
   - App name and description

2. **Mobile Meta Tags** (in `index.html`)

   - `apple-mobile-web-app-capable` - Enables iOS web app mode
   - `apple-mobile-web-app-status-bar-style` - Controls status bar appearance
   - `mobile-web-app-capable` - Enables Android web app mode
   - `viewport-fit=cover` - Supports devices with notches

3. **PWA Install Prompt Component** (`/src/components/PWAInstallPrompt.tsx`)

   - Detects mobile devices
   - Shows reminder to add app to home screen
   - Handles browser install prompt API
   - Remembers user dismissal for 7 days
   - Provides platform-specific instructions

4. **Service Worker** (`/public/sw.js`)

   - Basic caching for offline functionality
   - Required for PWA install criteria

5. **PWA-Specific CSS Styles**
   - Safe area support for notched devices
   - Disabled pull-to-refresh
   - Display mode specific styles
   - App-like user interaction styles

## Testing the PWA Functionality

### Desktop Testing

1. **Chrome/Edge**:

   - Open Developer Tools (F12)
   - Go to Application tab → Manifest
   - Verify manifest loads correctly
   - Click "Add to Home Screen" button in address bar (if available)

2. **Lighthouse PWA Audit**:
   - Open Developer Tools → Lighthouse tab
   - Run PWA audit to check compliance

### Mobile Testing

#### Android (Chrome)

1. Visit the app on mobile Chrome
2. You should see the PWA install prompt component at the bottom
3. Chrome may also show a native "Add to Home Screen" banner
4. After adding to home screen:
   - App launches in standalone mode (no browser UI)
   - Status bar remains visible
   - No address bar or browser controls

#### iOS (Safari)

1. Visit the app on mobile Safari
2. You'll see the custom install prompt (Safari doesn't support automatic prompts)
3. Tap the install button to see instructions
4. Manually add via: Share button → "Add to Home Screen"
5. After adding to home screen:
   - App launches in standalone mode
   - Status bar styling controlled by meta tags

### Verifying Standalone Mode

When the app is launched from the home screen icon:

1. **No Browser UI**: Address bar, navigation buttons, and browser menus are hidden
2. **Custom Title Bar**: App uses its own title (from HTML `<title>` tag)
3. **App-like Experience**: Feels like a native app
4. **Theme Integration**: Status bar and app chrome match your theme colors

### Testing Display Mode Detection

The app includes CSS that changes based on display mode:

```css
/* Only shows in browser mode */
.browser-only {
  display: block;
}

/* Only shows in standalone mode */
.standalone-only {
  display: none;
}
```

You can add these classes to elements to test if the detection works.

## Troubleshooting

### Install Prompt Not Showing

1. **Check PWA Criteria**: Use Lighthouse audit to ensure all PWA requirements are met
2. **HTTPS Required**: PWA features only work on HTTPS (or localhost for development)
3. **Service Worker**: Must be registered and active
4. **User Engagement**: Some browsers require user interaction before showing prompts

### Standalone Mode Not Working

1. **Clear Cache**: Clear browser data and try adding to home screen again
2. **Check Manifest**: Ensure manifest.json is accessible and valid
3. **Meta Tags**: Verify all required meta tags are present

### Icons Not Displaying

1. **File Paths**: Ensure icon files exist at specified paths
2. **Icon Sizes**: Provide multiple icon sizes for different devices
3. **Icon Format**: Use PNG format for best compatibility

## Development Notes

- The install prompt component respects user preferences (won't show again for 7 days if dismissed)
- Service worker caching can be customized for your app's specific needs
- Theme colors can be adjusted in both the manifest and meta tags
- Safe area CSS variables handle devices with notches automatically

## Browser Support

- **Chrome/Edge**: Full PWA support including install prompts
- **Safari iOS**: Partial support, requires manual "Add to Home Screen"
- **Firefox**: Basic PWA support
- **Samsung Internet**: Good PWA support on Android

The app gracefully degrades on browsers with limited PWA support.
