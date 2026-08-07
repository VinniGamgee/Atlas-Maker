// ===== SCRIPT.JS =====

window.onload = () => {

    const botao = document.getElementById("addImages");
    const input = document.getElementById("files");
    const colunas = document.getElementById("columns");

    botao.addEventListener("click", abrirSeletor);

    input.addEventListener("change", importarImagens);

    colunas.addEventListener("input", atualizarInterface);

    atualizarInterface();

};
