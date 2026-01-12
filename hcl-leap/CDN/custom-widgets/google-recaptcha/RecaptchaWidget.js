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
    // 1. LIMPIEZA PREVENTIVA: Borra cualquier rastro de una instanciación previa
    // Esto evita que aparezcan dos recuadros al cambiar entre Diseño y Vista Previa.
    domNode.innerHTML = "";

    // 2. GENERACIÓN DE ID ÚNICO
    // Usamos el ID interno de Leap si existe, de lo contrario un random.
    const uniqueId = context.dataId || Math.random().toString(36).substr(2, 9);
    const widgetId = "recaptcha_" + uniqueId;

    let token = "";
    let errorFn = null;

    // 3. CREACIÓN DE ELEMENTOS DEL DOM
    const container = document.createElement("div");
    container.id = widgetId;
    container.className = "recaptcha-container";
    domNode.appendChild(container);

    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.id = widgetId + "_hidden";
    hiddenInput.style.display = "none";
    domNode.appendChild(hiddenInput);

    // 4. LÓGICA DE RENDERIZADO
    function renderRecaptcha(attempt = 0) {
      const MAX_ATTEMPTS = 15;
      const DELAY = 500;

      // Si el objeto grecaptcha no está listo, reintentamos
      if (!window.grecaptcha || !window.grecaptcha.render) {
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(() => renderRecaptcha(attempt + 1), DELAY);
        } else {
          console.error(
            "[RecaptchaWidget] No se pudo cargar la API de Google."
          );
        }
        return;
      }

      // Si el contenedor ya tiene contenido (el iframe de Google), no renderizamos de nuevo
      if (container.hasChildNodes()) {
        return;
      }

      try {
        window.grecaptcha.render(widgetId, {
          sitekey: initialProps.siteKey,
          callback: function (responseToken) {
            token = responseToken;
            hiddenInput.value = token;
            if (errorFn) errorFn(null); // Limpiar mensaje de error
            eventManager.sendEvent("onChange");
          },
          "expired-callback": function () {
            token = "";
            hiddenInput.value = "";
            if (errorFn)
              errorFn(
                "El reCAPTCHA ha expirado. Por favor, verifica de nuevo."
              );
            eventManager.sendEvent("onChange");
          },
          "error-callback": function () {
            token = "";
            hiddenInput.value = "";
            if (errorFn) errorFn("Error de conexión con Google reCAPTCHA.");
            eventManager.sendEvent("onChange");
          },
        });
      } catch (e) {
        // Capturamos el error silenciosamente si es por re-renderizado
        console.warn("[RecaptchaWidget] Info:", e.message);
      }
    }

    // 5. CARGA DINÁMICA DEL SCRIPT DE GOOGLE (Singleton)
    const SCRIPT_ID = "google-recaptcha-api-script";
    let scriptTag = document.getElementById(SCRIPT_ID);

    if (!scriptTag) {
      scriptTag = document.createElement("script");
      scriptTag.id = SCRIPT_ID;
      scriptTag.src = "https://www.google.com/recaptcha/api.js?render=explicit";
      scriptTag.async = true;
      scriptTag.defer = true;
      scriptTag.onload = renderRecaptcha;
      document.head.appendChild(scriptTag);
    } else {
      // Si el script ya existe, simplemente intentamos renderizar
      renderRecaptcha();
    }

    // 6. INTERFAZ PÚBLICA DEL WIDGET (API de Leap)
    return {
      getValue: () => {
        return hiddenInput.value;
      },

      setValue: (val) => {
        // reCAPTCHA no permite setear un token manualmente por seguridad,
        // pero mantenemos el valor interno sincronizado.
        token = val || "";
        hiddenInput.value = token;
      },

      validateValue: () => {
        const val = hiddenInput.value;
        if (initialProps.required && (!val || val.trim() === "")) {
          const msg = "Por favor, completa la verificación anti-bots.";
          if (errorFn) errorFn(msg);
          return msg;
        }
        if (errorFn) errorFn(null);
        return null;
      },

      setProperty: (propName, propValue) => {
        if (propName === "siteKey") {
          initialProps.siteKey = propValue;
          // Si cambia la clave en tiempo de ejecución, reseteamos
          if (window.grecaptcha && window.grecaptcha.reset) {
            window.grecaptcha.reset();
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

// Registro del widget en el framework de Leap (Nitro)
nitro.registerWidget(recaptchaWidgetDefinition);
