package app.loomkeep;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.drawable.Drawable;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Logger;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

/** The picture beside a notification: a person's avatar, a work's poster, the admin mark. */
final class NotificationImages {

    private static final int TIMEOUT_MS = 3000;
    private static final int ICON_PX = 192;

    private NotificationImages() {}

    /** Null without one, or when it can't arrive quickly: the notification still shows. */
    static Bitmap load(Context context, Map<String, String> data) {
        if ("admin".equals(data.get("channel"))) return adminMark(context);

        String image = data.get("image");
        if (image == null) return null;

        Bitmap bitmap = download(context, image);
        if (bitmap == null) return null;
        return "person".equals(data.get("imageKind")) ? circle(bitmap) : bitmap;
    }

    private static Bitmap adminMark(Context context) {
        Drawable mark = ContextCompat.getDrawable(context, R.drawable.ic_notification_admin);
        Bitmap bitmap = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888);
        mark.setBounds(0, 0, ICON_PX, ICON_PX);
        mark.draw(new Canvas(bitmap));
        return bitmap;
    }

    private static Bitmap download(Context context, String image) {
        HttpURLConnection connection = null;
        try {
            String address = image.startsWith("/") ? NotificationActionReceiver.instanceOrigin(context) + image : image;
            connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setConnectTimeout(TIMEOUT_MS);
            connection.setReadTimeout(TIMEOUT_MS);
            try (InputStream stream = connection.getInputStream()) {
                return BitmapFactory.decodeStream(stream);
            }
        } catch (Exception e) {
            Logger.error("Notification image unavailable", e);
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static Bitmap circle(Bitmap source) {
        int size = Math.min(source.getWidth(), source.getHeight());
        Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        new Canvas(output).drawCircle(size / 2f, size / 2f, size / 2f, paint);
        return output;
    }
}
