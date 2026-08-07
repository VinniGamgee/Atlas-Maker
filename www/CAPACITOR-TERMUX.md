# Capacitor no Termux — Balatro Atlas

## 1. Plugins obrigatórios

No diretório do projeto Capacitor:

```bash
npm install @capacitor/filesystem @capacitor/share @capacitor/app
npx cap sync android
```

## 2. Copiar o web app

```bash
# Apague o conteúdo antigo de www (ou dist) e copie os arquivos deste zip:
cp -r index.html css js assets www/
# se usar pasta dist:
# cp -r index.html css js assets dist/

npx cap copy android
npx cap sync android
```

## 3. Permissões Android

O `AndroidManifest.xml` deste pacote já tem Storage + Internet.

No Capacitor 5/6 o Manifest fica em:

```
android/app/src/main/AndroidManifest.xml
```

Mescle as permissões (não apague o que o Capacitor gerou):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

No `<application>`:
```xml
android:requestLegacyExternalStorage="true"
android:usesCleartextTraffic="true"
```

Copie também:
```
res/xml/file_paths.xml  → android/app/src/main/res/xml/
res/xml/network_security_config.xml → android/app/src/main/res/xml/
```

## 4. Android 13+ — pedir permissão em runtime (opcional)

Se quiser, instale:
```bash
npm install @capacitor-community/media
# ou use Dialog + App permissions nativas
```

Na primeira vez que o usuário salvar, o Android pode pedir acesso a fotos/arquivos — aceite.

## 5. Build no Termux

```bash
npx cap open android
# ou build CLI:
cd android
./gradlew assembleDebug
```

APK debug costuma sair em:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

## 6. Como saber se deu certo

Ao abrir o app, na aba Atlas a barra de status deve mostrar algo como:

```
Capacitor:SIM · Filesystem:SIM · Share:SIM · Online
```

- **Filesystem:NÃO** → faltou `npm i @capacitor/filesystem` + `npx cap sync`
- **Capacitor:NÃO** → você abriu no navegador, ou o `www` não foi sincronizado

## 7. Uso

| Problema | Solução no app |
|----------|----------------|
| Remover fundo | **Magic** (offline) ou **Simple** (toque na imagem com borda vermelha) |
| Salvar PNG | Botão **Salvar PNG** → grava via Filesystem + abre Share |
| IA | Não depende dela no APK; Magic cobre o caso offline |

## 8. Onde o arquivo fica

O app grava em `BalatroAtlas/nome.png` dentro de DOCUMENTS ou EXTERNAL.
O menu **Compartilhar** permite mandar para **Downloads / Arquivos / Galeria**.


## 9. Barra de status cobrindo o app

Se a notificação cobrir o topo:

```bash
npm install @capacitor/status-bar
npx cap sync android
```

No `MainActivity` ou no JS após `deviceready` / Capacitor:

```js
if (window.Capacitor && Capacitor.Plugins.StatusBar) {
  Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: false });
  Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#0f0f12' });
}
```

O CSS do app já usa `safe-area-inset` + padding extra no header.
