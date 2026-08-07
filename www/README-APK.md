# Balatro Atlas — APK (Termux / HTML2APK / Cordova)

## O que mudou nesta versão

- **Magic e Simple funcionam 100% offline** (não dependem de internet nem de módulo ES).
- **IA é opcional** e só roda se o APK tiver permissão de internet + conexão.
- **Salvar PNG** tenta: Cordova File → bridge Android → download do WebView.

## Permissões obrigatórias no AndroidManifest.xml

Abra o `AndroidManifest.xml` do seu projeto (ou config do builder no Termux) e garanta:

```xml
<!-- Internet (só se quiser usar o botão IA) -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Armazenamento (salvar PNG) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

<!-- Android 11+ (opcional, acesso amplo) -->
<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"
    tools:ignore="ScopedStorage" />
```

No `<application>`:

```xml
android:requestLegacyExternalStorage="true"
android:usesCleartextTraffic="true"
```

`usesCleartextTraffic` ajuda se o WebView bloquear CDN HTTP/HTTPS da IA.

## Termux — onde editar

Dependendo da ferramenta que você usou:

1. **Cordova no Termux**
   - Arquivo: `platforms/android/app/src/main/AndroidManifest.xml`
   - Depois: `cordova build android`

2. **HTML to APK / WebView builders**
   - Procure a opção “Permissions” e marque:
     - Internet
     - Storage / Write external storage / Photos & media
   - Regenere o APK

3. **Se o builder não tiver opções**
   - Descompile o APK com `apktool`, edite o Manifest, recompile e assine.

## Teste offline

1. Ative modo avião.
2. Abra o app → Removedor → carregue imagem.
3. **Magic** e **Simple** devem funcionar.
4. **IA** deve avisar que precisa de internet (não pode travar o app).

## Salvar PNG não grava?

1. Confirme as permissões de armazenamento no Manifest.
2. No Android 10+, o app pode pedir permissão em tempo de execução — aceite.
3. O arquivo pode ir para:
   - `Download/`
   - `BalatroAtlas/`
   - pasta interna do app
4. Se ainda falhar, o app inicia o “download” do WebView — veja a notificação de downloads do sistema.

## Estrutura

```
balatro-atlas-app/
├── index.html      ← script clássico (não module)
├── css/style.css
├── js/script.js    ← offline-first
├── assets/
└── README-APK.md
```

Copie essa pasta inteira para a pasta `www/` do Cordova ou para o builder HTML→APK.
