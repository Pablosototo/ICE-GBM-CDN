const recaptchaWidgetDefinition = {
  id: "custom.Recaptcha",
  version: "2.1.0",
  apiVersion: "1.0.0",
  label: "Google reCAPTCHA",
  description: "Verificación anti-bots con Google reCAPTCHA",
  datatype: { type: "string", length: 3000, customDataType: "recaptcha-token" },
  category: { id: "custom.security", label: "Widgets personalizados" },
  iconClassName: "recaptcha-icon",

  // BUILT-IN PROPERTIES DE LEAP
  builtInProperties: [
    { id: "title" },
    { id: "id" },
    { id: "required" },
    { id: "seenInOverview", defaultValue: true },
  ],

  // PROPIEDADES PERSONALIZADAS
  properties: [
    {
      id: "siteKey",
      label: "Clave del sitio (SiteKey)",
      propType: "string",
      defaultValue: "",
    },
  ],

  instantiate: function (context, domNode, initialProps, eventManager) {
    const widgetId =
      "recaptcha_" +
      (context.dataId || Math.random().toString(36).substr(2, 9));

    let token = "";
    let errorFn = null;
    let container = null;

    // CONTENEDOR PRINCIPAL
    container = document.createElement("div");
    container.id = widgetId;
    domNode.appendChild(container);

    // INPUT OCULTO (VALOR REAL PARA LEAP)
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.id = widgetId + "_hidden";
    hiddenInput.value = "";
    hiddenInput.style.display = "none";
    domNode.appendChild(hiddenInput);

    // ----------------------------
    // RENDER DEL RECAPTCHA
    // ----------------------------
    function renderRecaptcha(attempt = 0) {
      const MAX_ATTEMPTS = 10;
      const DELAY = 500;

      if (!window.grecaptcha || !window.grecaptcha.render) {
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(() => renderRecaptcha(attempt + 1), DELAY);
        }
        return;
      }

      try {
        window.grecaptcha.render(widgetId, {
          sitekey: initialProps.siteKey,

          callback: function (responseToken) {
            token = responseToken;
            hiddenInput.value = token;

            if (errorFn) errorFn(null);
            eventManager.sendEvent("onChange");
          },

          "expired-callback": function () {
            token = "";
            hiddenInput.value = "";

            if (errorFn) {
              errorFn("El reCAPTCHA expiró, por favor vuelve a verificar");
            }

            eventManager.sendEvent("onChange");
          },

          "error-callback": function () {
            token = "";
            hiddenInput.value = "";

            if (errorFn) {
              errorFn("Ocurrió un error al cargar el reCAPTCHA");
            }

            eventManager.sendEvent("onChange");
          },
        });
      } catch (e) {
        console.error("[RecaptchaWidget] Error renderizando:", e);
      }
    }

    // ----------------------------
    // CARGA DEL SCRIPT DE GOOGLE
    // ----------------------------
    const existingScript = document.querySelector(
      "script[src*='recaptcha/api.js']"
    );

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.google.com/recaptcha/api.js";
      script.async = true;
      script.defer = true;
      script.onload = renderRecaptcha;
      document.head.appendChild(script);
    } else {
      renderRecaptcha();
    }

    // ----------------------------
    // API DEL WIDGET PARA LEAP
    // ----------------------------
    return {
      getValue: () => {
        return hiddenInput.value;
      },

      setValue: (val) => {
        token = val || "";
        hiddenInput.value = token;
      },

      validateValue: () => {
        const val = hiddenInput.value;

        if (initialProps.required && (!val || val.trim() === "")) {
          const msg = "Por favor completa el reCAPTCHA";
          if (errorFn) errorFn(msg);
          return msg;
        }

        if (errorFn) errorFn(null);
        return null;
      },

      setProperty: (propName, propValue) => {
        if (propName === "siteKey") {
          initialProps.siteKey = propValue;
          token = "";
          hiddenInput.value = "";

          if (window.grecaptcha) {
            try {
              window.grecaptcha.reset();
              renderRecaptcha();
            } catch (e) {
              console.warn("No se pudo resetear reCAPTCHA:", e);
            }
          }
        }
      },

      setRequired: (required) => {
        initialProps.required = required;
      },

      setErrorMessage: (fn) => {
        errorFn = fn;
      },
    };
  },
};

nitro.registerWidget(recaptchaWidgetDefinition);
