# Ícone do app (Steve Joker)

## Arquivos gerados

- `resources/icon.png` — 1024×1024 (para `@capacitor/assets`)
- `android-icons/mipmap-*/ic_launcher.png` — ícones legados
- `android-icons/mipmap-*/ic_launcher_foreground.png` — adaptive icon
- `android-icons/mipmap-anydpi-v26/*.xml`
- `android-icons/values/ic_launcher_background.xml` — fundo `#0F0F12`

## Instalar no projeto Capacitor (Termux)

```bash
# Na raiz do seu app Capacitor:

# 1) Ícone master
mkdir -p resources
cp caminho/para/balatro-atlas-app/resources/icon.png resources/icon.png

# 2) Copiar mipmaps
cp -r caminho/para/balatro-atlas-app/android-icons/mipmap-* android/app/src/main/res/
cp caminho/para/balatro-atlas-app/android-icons/values/ic_launcher_background.xml android/app/src/main/res/values/

# Se já existir values/colors.xml, mescle a cor:
# <color name="ic_launcher_background">#0F0F12</color>

npx cap sync android
cd android && ./gradlew assembleDebug
```

### Alternativa com capacitor-assets

```bash
npm install -D @capacitor/assets
# resources/icon.png já é 1024x1024
npx capacitor-assets generate --android
npx cap sync android
```

No `AndroidManifest.xml` deve constar:

```xml
android:icon="@mipmap/ic_launcher"
android:roundIcon="@mipmap/ic_launcher_round"
```
