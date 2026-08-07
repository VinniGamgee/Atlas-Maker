// ===== LUA.JS =====

function gerarLua() {

    const lua = document.getElementById("lua");

    if (!lua) return;

    let texto = `SMODS.Atlas{
    key = "Jokers",
    path = "Jokers.png",
    px = ${cardWidth},
    py = ${cardHeight}
}\n\n`;

    const colunas =
        Number(document.getElementById("columns").value) || 10;

    imagens.forEach((img, index) => {

        const x = index % colunas;
        const y = Math.floor(index / colunas);

        texto += `SMODS.Joker{
    key = "${img.nome}",
    atlas = "Jokers",
    pos = {x=${x}, y=${y}}
}\n\n`;

    });

    lua.textContent = texto;
}

function copiarLua() {

    navigator.clipboard.writeText(
        document.getElementById("lua").textContent
    );

    alert("Lua copiado!");

}
