package app.loomkeep;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;

/**
 * Serves the shell's own page, www/error.html, whatever its query and
 * fragment. Once server.url is set, Capacitor serves a local page only at
 * the exact error URL and sends any other to the network, while the
 * WebView keeps the fragment in the URL it requests: the instance picker,
 * error.html#pick (ShellInstancePlugin), would never load.
 */
class ShellWebViewClient extends BridgeWebViewClient {

    private static final String PAGE = "error.html";

    private final Bridge bridge;

    ShellWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        boolean shellPage =
            bridge.getScheme().equals(url.getScheme()) && bridge.getHost().equals(url.getHost()) && ("/" + PAGE).equals(url.getPath());
        if (!shellPage) return super.shouldInterceptRequest(view, request);

        try {
            return new WebResourceResponse("text/html", "utf-8", view.getContext().getAssets().open(Bridge.DEFAULT_WEB_ASSET_DIR + "/" + PAGE));
        } catch (IOException e) {
            return super.shouldInterceptRequest(view, request);
        }
    }
}
