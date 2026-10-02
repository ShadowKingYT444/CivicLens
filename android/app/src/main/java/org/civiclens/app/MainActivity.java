package org.civiclens.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/** A server-connected Android client. Provider credentials never belong here. */
public final class MainActivity extends Activity {
    private LinearLayout root;
    private WebView web;
    private TextView error;
    private ProgressBar progress;
    private String serverUrl;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(247, 251, 255));
        getWindow().setNavigationBarColor(Color.rgb(247, 251, 255));
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(247, 251, 255));
        // Android 15 enforces edge-to-edge. Keep controls clear of system bars.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root);
        serverUrl = getPreferences(MODE_PRIVATE).getString("serverUrl", "");
        if (serverUrl.isEmpty()) showConnection();
        else if (validServer(serverUrl)) openApp(state);
        else showConnection();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private boolean validServer(String value) {
        try {
            Uri uri = Uri.parse(value);
            return uri.getHost() != null && !uri.getHost().isEmpty() && uri.getUserInfo() == null
                && uri.getQuery() == null && uri.getFragment() == null
                && (uri.getPath() == null || uri.getPath().isEmpty() || "/".equals(uri.getPath()))
                && ("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme())
                    && ("127.0.0.1".equals(uri.getHost()) || "localhost".equals(uri.getHost())
                        || "10.0.2.2".equals(uri.getHost()))));
        } catch (RuntimeException exception) { return false; }
    }

    private boolean sameOrigin(String value) {
        if (serverUrl == null || serverUrl.isEmpty()) return false;
        Uri expected = Uri.parse(serverUrl), actual = Uri.parse(value);
        return expected.getScheme().equals(actual.getScheme())
            && expected.getHost().equalsIgnoreCase(actual.getHost() == null ? "" : actual.getHost())
            && normalizedPort(expected) == normalizedPort(actual);
    }

    private int normalizedPort(Uri uri) {
        return uri.getPort() >= 0 ? uri.getPort() : "https".equals(uri.getScheme()) ? 443 : 80;
    }

    private void showConnection() {
        destroyWeb();
        root.removeAllViews();
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(24), dp(24), dp(24), dp(24));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true); scroll.addView(panel); root.addView(scroll);
        TextView title = new TextView(this);
        title.setText("Connect to CivicLens"); title.setTextSize(26);
        title.setTextColor(Color.rgb(7, 26, 51)); panel.addView(title);
        TextView help = new TextView(this);
        help.setText("Enter the HTTPS address of your CivicLens server. For a local USB demo, start the server on your computer and run adb reverse tcp:3100 tcp:3100, then choose USB demo.\n\nAPI keys stay on the server. This app needs a server connection; it does not contain an offline AI model.");
        help.setPadding(0, dp(16), 0, dp(16)); panel.addView(help);
        EditText address = new EditText(this);
        address.setSingleLine(true); address.setHint("https://your-civiclens-server.example");
        address.setContentDescription("CivicLens server address");
        address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        address.setText(serverUrl == null ? "" : serverUrl); panel.addView(address);
        Button connect = new Button(this); connect.setText("Connect"); panel.addView(connect);
        connect.setOnClickListener(view -> connect(address.getText().toString().trim()));
        Button usb = new Button(this); usb.setText("Use USB demo"); panel.addView(usb);
        usb.setOnClickListener(view -> connect("http://127.0.0.1:3100"));
    }

    private void connect(String value) {
        if (!validServer(value)) {
            new AlertDialog.Builder(this).setMessage("Use a root HTTPS server address, or the local USB demo address. Do not include passwords, API keys, query strings, or paths.")
                .setPositiveButton("OK", null).show(); return;
        }
        serverUrl = value.replaceAll("/+$", "");
        getPreferences(MODE_PRIVATE).edit().putString("serverUrl", serverUrl).apply();
        openApp(null);
    }

    private void openApp(Bundle state) {
        root.removeAllViews();
        LinearLayout toolbar = new LinearLayout(this);
        TextView brand = new TextView(this); brand.setText("CivicLens"); brand.setTextSize(18);
        brand.setPadding(dp(12), dp(12), 0, dp(12));
        toolbar.addView(brand, new LinearLayout.LayoutParams(0, -2, 1));
        Button settings = new Button(this); settings.setText("Server");
        settings.setContentDescription("Change CivicLens server");
        settings.setOnClickListener(view -> showConnection()); toolbar.addView(settings);
        root.addView(toolbar);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        error = new TextView(this); error.setTextColor(Color.rgb(145, 35, 35));
        error.setPadding(dp(12), dp(12), dp(12), dp(12)); error.setVisibility(View.GONE);
        error.setText("Could not connect. Check your server or USB connection, then tap here to retry.");
        error.setOnClickListener(view -> { error.setVisibility(View.GONE); web.loadUrl(serverUrl); });
        root.addView(error);
        web = new WebView(this);
        WebSettings options = web.getSettings();
        options.setJavaScriptEnabled(true); options.setDomStorageEnabled(true);
        options.setAllowFileAccess(false); options.setAllowContentAccess(false);
        options.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        options.setGeolocationEnabled(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (sameOrigin(request.getUrl().toString())) return false;
                if (request.hasGesture() && "https".equals(request.getUrl().getScheme())) openExternal(request.getUrl());
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                error.setVisibility(View.GONE); progress.setVisibility(View.VISIBLE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError issue) {
                if (request.isForMainFrame()) { error.setVisibility(View.VISIBLE); progress.setVisibility(View.GONE); }
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) error.setVisibility(View.VISIBLE);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int percent) {
                progress.setProgress(percent); progress.setVisibility(percent == 100 ? View.GONE : View.VISIBLE);
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, android.os.Message result) {
                return false;
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!sameOrigin(origin) || locationCallback != null) { callback.invoke(origin, false, false); return; }
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false); return;
                }
                locationCallback = callback; locationOrigin = origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 11);
            }
            @Override public void onGeolocationPermissionsHidePrompt() { cancelLocation(); }
        });
        // No JavaScript/native bridge and no WebView debugging in the delivered APK.
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        if (state == null || web.restoreState(state) == null) web.loadUrl(serverUrl);
    }

    private void openExternal(Uri uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (android.content.ActivityNotFoundException exception) { Toast.makeText(this, "No browser is installed.", Toast.LENGTH_SHORT).show(); }
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 11 && locationCallback != null) {
            boolean granted = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            locationCallback.invoke(locationOrigin, granted, false); locationCallback = null; locationOrigin = null;
        }
    }

    private void cancelLocation() {
        if (locationCallback != null) locationCallback.invoke(locationOrigin, false, false);
        locationCallback = null; locationOrigin = null;
    }

    private void destroyWeb() {
        cancelLocation();
        if (web != null) { web.stopLoading(); web.destroy(); web = null; }
    }

    @Override public void onSaveInstanceState(Bundle state) {
        if (web != null) web.saveState(state);
        super.onSaveInstanceState(state);
    }
    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
    @Override public void onDestroy() { destroyWeb(); super.onDestroy(); }
}
