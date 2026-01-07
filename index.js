'use strict';var metro=require('@vendetta/metro'),plugin=require('@vendetta/plugin'),common=require('@vendetta/metro/common'),components=require('@vendetta/ui/components'),storage=require('@vendetta/storage');async function translate(kind, text) {
    const service = plugin.storage.service || "google";
    const targetLang = plugin.storage[`${kind}Output`] || "en";
    if (service === "google") {
        const params = new URLSearchParams({
            "client": "gtx", "sl": "auto", "tl": targetLang, "dt": "t", "q": text
        });
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
        const data = await res.json();
        return { text: data[0].map((x) => x[0]).join(""), source: data[2] };
    }
    else {
        // Lógica simplificada para DeepL
        return { text: "Service not configured", source: "error" };
    }
}const GoogleLanguages = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "pt": "Portuguese",
    "ru": "Russian",
    "zh": "Chinese"
};
const DeeplLanguages = {
    "EN-US": "English (US)",
    "ES": "Spanish",
    "FR": "French",
    "DE": "German",
    "JA": "Japanese"
};const { FormSection, FormSwitch, FormDivider, FormInput, FormLabel } = components.Forms;
function SettingsUI() {
    storage.useProxy(plugin.storage);
    const langs = plugin.storage.service === "google" ? GoogleLanguages : DeeplLanguages;
    const langOptions = Object.entries(langs).map(([value, label]) => ({
        label: label,
        value: value
    }));
    return (common.React.createElement(components.Forms.FormScrollView, null,
        common.React.createElement(FormSection, { title: "Servicio de Traducci\u00F3n" },
            common.React.createElement(components.SearchablePicker, { label: "Servicio", value: plugin.storage.service, onValueChange: (v) => plugin.storage.service = v, items: [
                    { label: "Google Translate", value: "google" },
                    { label: "DeepL Free", value: "deepl" },
                    { label: "DeepL Pro", value: "deepl-pro" }
                ] }),
            plugin.storage.service.startsWith("deepl") && (common.React.createElement(FormInput, { label: "DeepL API Key", placeholder: "Introduce tu clave...", value: plugin.storage.deeplApiKey, onChange: (v) => plugin.storage.deeplApiKey = v }))),
        common.React.createElement(FormDivider, null),
        common.React.createElement(FormSection, { title: "Traducci\u00F3n de Mensajes (Recibidos)" },
            common.React.createElement(components.SearchablePicker, { label: "Idioma Destino", value: plugin.storage.receivedOutput, onValueChange: (v) => plugin.storage.receivedOutput = v, items: langOptions })),
        common.React.createElement(FormSection, { title: "Auto-Traducci\u00F3n (Al enviar)" },
            common.React.createElement(FormSwitch, { label: "Activar Auto-Translate", value: plugin.storage.autoTranslate, onValueChange: (v) => plugin.storage.autoTranslate = v }),
            common.React.createElement(components.SearchablePicker, { label: "Traducir mis mensajes a:", value: plugin.storage.sentOutput, onValueChange: (v) => plugin.storage.sentOutput = v, items: langOptions }))));
}const MessageActions = metro.findByProps("sendMessage", "editMessage");
const ActionSheet = metro.findByProps("openLazy", "hideActionSheet");
const { Text } = metro.findByProps("Text", "View");
const translationsCache = new Map();
var index = {
    onLoad: () => {
        plugin.storage.service ??= "google";
        plugin.storage.receivedOutput ??= "en";
        plugin.storage.sentOutput ??= "en";
        plugin.storage.autoTranslate ??= false;
        const MessageActionSheet = metro.findByName("MessageActionSheet", false);
        metro.patcher.after("default", MessageActionSheet, ([{ message }], res) => {
            const buttons = res.props.children.props.children;
            buttons.push({
                label: "Translate",
                onPress: async () => {
                    ActionSheet.hideActionSheet();
                    try {
                        const res = await translate("received", message.content);
                        translationsCache.set(message.id, res);
                        common.toast.show("Message Translated");
                    }
                    catch (e) {
                        common.toast.show("Error: " + e.message);
                    }
                }
            });
        });
        const MessageContent = metro.findByName("MessageContent", false);
        metro.patcher.after("default", MessageContent, ([{ message }], res) => {
            if (translationsCache.has(message.id)) {
                const tr = translationsCache.get(message.id);
                res.props.children.push(common.React.createElement(Text, {
                    style: {
                        marginTop: 4,
                        padding: 4,
                        backgroundColor: "rgba(128, 128, 128, 0.1)",
                        borderRadius: 4,
                        fontStyle: "italic",
                        color: "#b9bbbe"
                    }
                }, `Traducido (${tr.source}): ${tr.text}`));
            }
        });
        metro.patcher.before("sendMessage", MessageActions, async (args) => {
            if (plugin.storage.autoTranslate && args[1]?.content) {
                try {
                    const res = await translate("sent", args[1].content);
                    args[1].content = res.text;
                }
                catch (e) {
                    console.error(e);
                }
            }
        });
    },
onUnload: () => {
        metro.patcher.unpatchAll();
        translationsCache.clear();
    },
    settings: SettingsUI
};

module.exports = { default: index };
