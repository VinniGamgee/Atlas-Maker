// ===== IMAGE.JS =====

let imagens = [];

function abrirSeletor() {
    document.getElementById("files").click();
}

function importarImagens(event) {

    const arquivos = [...event.target.files];

    arquivos.forEach(arquivo => {

        if (!arquivo.type.startsWith("image/")) return;

        const img = new Image();

        img.onload = () => {

            imagens.push({
                nome: arquivo.name.replace(/\.[^/.]+$/, ""),
                imagem: img
            });

            atualizarInterface();

        };

        img.src = URL.createObjectURL(arquivo);

    });

}
