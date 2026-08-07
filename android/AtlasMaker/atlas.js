// ===== ATLAS.JS =====

let cardWidth = 71;
let cardHeight = 95;

function setSize(w, h) {
    cardWidth = w;
    cardHeight = h;
    atualizarInterface();
}

function atualizarInterface() {
    atualizarLista();
    gerarAtlas();
    gerarLua();
}

function atualizarLista() {

    const lista = document.getElementById("images");

    lista.innerHTML = "";

    imagens.forEach((item) => {

        const div = document.createElement("div");

        div.className = "thumb";

        div.innerHTML = `
            <img src="${item.imagem.src}" width="45">
            <span>${item.nome}</span>
        `;

        lista.appendChild(div);

    });

}

function gerarAtlas() {

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    if (imagens.length === 0) {

        ctx.clearRect(0,0,canvas.width,canvas.height);
        return;

    }

    const colunas =
        Number(document.getElementById("columns").value) || 10;

    const linhas =
        Math.ceil(imagens.length / colunas);

    canvas.width =
        colunas * cardWidth;

    canvas.height =
        linhas * cardHeight;

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.imageSmoothingEnabled = false;

    imagens.forEach((item, index) => {

        const x =
            (index % colunas) * cardWidth;

        const y =
            Math.floor(index / colunas) * cardHeight;

        desenharCarta(ctx, item.imagem, x, y);

    });

}

function desenharCarta(ctx, img, x, y) {

    const escala = Math.min(
        cardWidth / img.width,
        cardHeight / img.height
    );

    const largura = img.width * escala;
    const altura = img.height * escala;

    const px = x + (cardWidth - largura) / 2;
    const py = y + (cardHeight - altura) / 2;

    ctx.drawImage(
        img,
        px,
        py,
        largura,
        altura
    );

}
