package com.validator.leap.recaptcha;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URL;
import java.net.URLEncoder;
import java.util.List;
import java.util.Map;

import javax.net.ssl.HttpsURLConnection;

import com.ibm.form.nitro.service.data.integrity.DataIntegrityException;
import com.ibm.form.nitro.service.data.integrity.IDataField;
import com.ibm.form.nitro.service.data.integrity.IDataIntegrityService;
import com.ibm.form.nitro.service.data.integrity.IMetaData;

public class RecaptchaValidator implements IDataIntegrityService {

    private static final String RECAPTCHA_SECRET = "6Ld6dUUsAAAAAHHJeJvP1gLhHscIIiMd0ymE9Jzh";

    private static final String VERIFY_URL =
            "https://www.google.com/recaptcha/api/siteverify";

    @Override
    public void processIncomingData(IMetaData metadata,
                                    List<IDataField> dataFields,
                                    LifecycleStep step,
                                    Logger logger)
            throws DataIntegrityException {

        if (step != LifecycleStep.PRE_STORE) {
            return;
        }

        if (logger != null) {
            logger.info("RecaptchaValidator: PRE_STORE validation");
        }

        for (IDataField field : dataFields) {

            if ("recaptcha-token".equals(field.getCustomDataType())) {

                String token = (String) field.getValue();

                if (token == null || token.trim().isEmpty()) {
                    throw new DataIntegrityException("reCAPTCHA token is required");
                }

                String clientIp = extractClientIp(metadata);

                boolean valid = verifyWithGoogle(token, clientIp, logger);

                if (!valid) {
                    throw new DataIntegrityException("reCAPTCHA validation failed");
                }

                // Borrar el token para que no se guarde en DB
                field.setValue("");
            }
        }
    }

    private String extractClientIp(IMetaData metadata) {
        Map<String, List<String>> headers = metadata.getRequestHeaders();
        if (headers == null) return null;

        List<String> xff = headers.get("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            String headerValue = xff.get(0);
            int commaIndex = headerValue.indexOf(',');
            return commaIndex > 0 ?
                    headerValue.substring(0, commaIndex).trim() :
                    headerValue.trim();
        }

        List<String> realIp = headers.get("X-Real-IP");
        if (realIp != null && !realIp.isEmpty()) {
            return realIp.get(0).trim();
        }

        return null;
    }

    private boolean verifyWithGoogle(String token, String clientIp, Logger logger) {

        HttpsURLConnection conn = null;

        try {
            StringBuilder postData = new StringBuilder();
            postData.append("secret=").append(URLEncoder.encode(RECAPTCHA_SECRET, "UTF-8"));
            postData.append("&response=").append(URLEncoder.encode(token, "UTF-8"));

            if (clientIp != null && !clientIp.trim().isEmpty()) {
                postData.append("&remoteip=").append(URLEncoder.encode(clientIp, "UTF-8"));
            }

 
            byte[] postBytes = postData.toString().getBytes("UTF-8");

            URL url = new URL(VERIFY_URL);
            conn = (HttpsURLConnection) url.openConnection();

            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type",
                    "application/x-www-form-urlencoded; charset=UTF-8");
            conn.setFixedLengthStreamingMode(postBytes.length);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(postBytes);
            }

            int status = conn.getResponseCode();

            InputStream is = status >= 200 && status < 300
                    ? conn.getInputStream()
                    : conn.getErrorStream();

            StringBuilder body = new StringBuilder();
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(is, "UTF-8"))) {

                String line;
                while ((line = br.readLine()) != null) {
                    body.append(line);
                }
            }

            String json = body.toString();

            if (logger != null) {
                logger.info("reCAPTCHA server response: " + json);
            }

            return json.contains("\"success\": true");

        } catch (Exception e) {

            if (logger != null) {
                logger.error("Error calling reCAPTCHA: " + e.getMessage());
            }

            return false;

        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
