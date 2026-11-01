package app.loomkeep;

import android.net.Uri;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Serves the shell's own page, www/error.html, whatever its query and
 * fragment, and its fonts. Once server.url is set, Capacitor serves a local
 * page only at the exact error URL and sends any other to the network, while
 * the WebView keeps the fragment in the URL it requests: the instance picker,
 * error.html#pick (ShellInstancePlugin), would never load.
 */
class ShellWebViewClient extends BridgeWebViewClient {

    private static final String PAGE = "error.html";
    private static final String[] FONTS = {
        "/shell-fonts/bricolage-grotesque.woff2",
        "/shell-fonts/hanken-grotesk.woff2",
        "/shell-fonts/space-mono.woff2",
    };

    private final Bridge bridge;
    private final Runnable onShellPage;
    private String failedUrl;

    ShellWebViewClient(Bridge bridge, Runnable onShellPage) {
        super(bridge);
        this.bridge = bridge;
        this.onShellPage = onShellPage;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        boolean local = bridge.getScheme().equals(url.getScheme()) && bridge.getHost().equals(url.getHost());
        if (!local) return super.shouldInterceptRequest(view, request);

        try {
            if (("/" + PAGE).equals(url.getPath())) {
                // This page has no bridge to call: asking for it is the signal
                // that no web app will come to end the launch screen.
                onShellPage.run();
                return new WebResourceResponse("text/html", "utf-8", page(view));
            }
            for (String font : FONTS) {
                if (font.equals(url.getPath())) {
                    return new WebResourceResponse("font/woff2", null, asset(view, font));
                }
            }
        } catch (IOException e) {
            return super.shouldInterceptRequest(view, request);
        }
        return super.shouldInterceptRequest(view, request);
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame()) failedUrl = request.getUrl().toString();
        super.onReceivedError(view, request, error);
    }

    /**
     * A navigation the page itself started (SvelteKit reloading when a page's
     * code can't be fetched offline): the WebView commits its own error page
     * after onReceivedError, over the shell page requested there.
     */
    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (url.contains("/" + PAGE)) {
            failedUrl = null;
        } else if (url.equals(failedUrl)) {
            failedUrl = null;
            view.loadUrl(bridge.getErrorUrl());
        }
    }

    /** The page in the theme the app was last in: it can't read the web's localStorage. */
    private InputStream page(WebView view) throws IOException {
        String html;
        try (InputStream asset = asset(view, "/" + PAGE)) {
            html = InstanceConfig.readAll(asset);
        }
        String theme = ShellAppearance.isDark(view.getContext()) ? "dark" : "light";
        html = html.replace("<html lang=\"en\">", "<html lang=\"en\" data-theme=\"" + theme + "\">");
        return new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8));
    }

    private InputStream asset(WebView view, String path) throws IOException {
        return view.getContext().getAssets().open(Bridge.DEFAULT_WEB_ASSET_DIR + path);
    }
}
