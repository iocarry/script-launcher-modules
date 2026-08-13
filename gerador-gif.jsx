(function(thisObj) {
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Gerador de GIF Independente", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 14;

        // Header Titulo
        var headerGrp = win.add("group");
        headerGrp.orientation = "column";
        headerGrp.alignment = ["fill", "top"];
        var titleTxt = headerGrp.add("statictext", undefined, "GIF Exporter Pro");
        titleTxt.graphics.font = ScriptUI.newFont("Tahoma", "Bold", 13);
        titleTxt.alignment = "center";

        var divider1 = win.add("panel", undefined, undefined);
        divider1.alignment = ["fill", "top"];

        // 1. Destino (Location Customizado)
        var locGrp = win.add("group");
        locGrp.orientation = "row";
        locGrp.alignChildren = ["left", "center"];
        var locLbl = locGrp.add("statictext", undefined, "Destino:");
        locLbl.size = [65, 20];
        
        var locInput = locGrp.add("edittext", undefined, "Padrão (Pasta do Projeto)");
        locInput.size = [140, 22];

        var locBtn = locGrp.add("button", undefined, "📂");
        locBtn.size = [30, 22];
        locBtn.helpTip = "Escolher pasta personalizada de saída";
        locBtn.onClick = function() {
            var selectedFolder = Folder.selectDialog("Selecione a pasta onde o GIF será salvo");
            if (selectedFolder) {
                locInput.text = selectedFolder.fsName;
            }
        };

        // 2. Resolução / Largura
        var widthGrp = win.add("group");
        widthGrp.orientation = "row";
        widthGrp.alignChildren = ["left", "center"];
        var widthLbl = widthGrp.add("statictext", undefined, "Largura:");
        widthLbl.size = [65, 20];
        
        var widthInput = widthGrp.add("edittext", undefined, "As Comp");
        widthInput.size = [110, 22];

        var origBtn = widthGrp.add("button", undefined, "Original");
        origBtn.size = [60, 22];
        origBtn.onClick = function() {
            widthInput.text = "As Comp";
        };

        // 3. Opções de FPS (As Comp, 8, 12, 24, 30, 60)
        var fpsGrp = win.add("group");
        fpsGrp.orientation = "row";
        fpsGrp.alignChildren = ["left", "center"];
        var fpsLbl = fpsGrp.add("statictext", undefined, "FPS:");
        fpsLbl.size = [65, 20];

        var fpsOptions = [
            "As Comp (Original)",
            "8 FPS",
            "12 FPS",
            "24 FPS",
            "30 FPS",
            "60 FPS"
        ];
        var fpsDropDown = fpsGrp.add("dropdownlist", undefined, fpsOptions);
        fpsDropDown.size = [176, 22];
        fpsDropDown.selection = 0; // Default As Comp

        // 4. Cores / Qualidade (256, 128, 64, 32, 16, 8)
        var colorGrp = win.add("group");
        colorGrp.orientation = "row";
        colorGrp.alignChildren = ["left", "center"];
        var colorLbl = colorGrp.add("statictext", undefined, "Cores:");
        colorLbl.size = [65, 20];

        var colorOptions = [
            "256 cores (Máxima)",
            "128 cores (Alta)",
            "64 cores (Média)",
            "32 cores (Compacta)",
            "16 cores (Retro)",
            "8 cores (Mínima)"
        ];
        var colorDropDown = colorGrp.add("dropdownlist", undefined, colorOptions);
        colorDropDown.size = [176, 22];
        colorDropDown.selection = 0; // Default 256

        // 5. Checkbox Abrir pasta ao finalizar
        var openFolderChk = win.add("checkbox", undefined, "Abrir pasta ao finalizar");
        openFolderChk.value = true;

        // 6. Label de Status da Operação
        var statusLabel = win.add("statictext", undefined, "Pronto para exportar");
        statusLabel.graphics.foregroundColor = statusLabel.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [0.4, 0.7, 1, 1], 1);
        statusLabel.alignment = "center";

        // 7. Botão Principal "Gerar GIF"
        var btnExport = win.add("button", undefined, "🎬 Gerar GIF");
        btnExport.size = [-1, 34];

        // Função de Verificação e Download de Binários Padrão
        function ensureBinariesExist() {
            var binDir = new Folder(Folder.userData.fsName + "/ScriptLauncher/bin");
            if (!binDir.exists) binDir.create();

            var ffmpegFile = new File(binDir.fsName + "/ffmpeg.exe");
            var gifsicleFile = new File(binDir.fsName + "/gifsicle.exe");

            if (!ffmpegFile.exists) {
                var confirmDL = confirm("Os componentes para geração de GIF (FFmpeg / Gifsicle) não foram encontrados nesta máquina.\n\nDeseja realizar o download automático do pacote (~35 MB) agora para a sua pasta do ScriptLauncher?");
                if (!confirmDL) return false;

                statusLabel.text = "⏳ Baixando componentes (~35 MB)...";
                win.update();

                var zipUrl = "https://raw.githubusercontent.com/iocarry/script-launcher-modules/main/gif_tools.zip";
                var zipFile = new File(binDir.fsName + "/gif_tools.zip");

                var psCmd = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri \'' + zipUrl + '\' -OutFile \'' + zipFile.fsName.replace(/\//g, "\\") + '\'; Expand-Archive -Path \'' + zipFile.fsName.replace(/\//g, "\\") + '\' -DestinationPath \'' + binDir.fsName.replace(/\//g, "\\") + '\' -Force; Remove-Item \'' + zipFile.fsName.replace(/\//g, "\\") + '\' -Force"';
                system.callSystem(psCmd);

                ffmpegFile = new File(binDir.fsName + "/ffmpeg.exe");
                if (!ffmpegFile.exists) {
                    statusLabel.text = "❌ Erro no download dos componentes";
                    alert("Erro: Não foi possível realizar o download automático dos componentes. Verifique sua conexão de internet.");
                    return false;
                }
                statusLabel.text = "✨ Componentes instalados com sucesso!";
                win.update();
            }

            return {
                ffmpeg: ffmpegFile.fsName,
                gifsicle: gifsicleFile.exists ? gifsicleFile.fsName : null
            };
        }

        btnExport.onClick = function() {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) {
                alert("Por favor, abra ou selecione uma composição ativa no After Effects!");
                return;
            }

            // Verificar se os executáveis estão na pasta padrão do usuário
            var bins = ensureBinariesExist();
            if (!bins) return;

            var ffmpegPath = bins.ffmpeg;
            var gifsiclePath = bins.gifsicle || "";

            // A. Obter FPS
            var fpsArr = [0, 8, 12, 24, 30, 60];
            var selectedFpsIndex = fpsDropDown.selection ? fpsDropDown.selection.index : 0;
            var targetFps = (selectedFpsIndex === 0) ? comp.frameRate : fpsArr[selectedFpsIndex];

            // B. Obter Largura
            var customWidthStr = widthInput.text;
            var targetWidth = comp.width;
            if (customWidthStr !== "As Comp" && customWidthStr !== "Original" && customWidthStr !== "" && !isNaN(parseInt(customWidthStr, 10))) {
                var parsedW = parseInt(customWidthStr, 10);
                if (parsedW > 0) targetWidth = parsedW;
            }

            // C. Obter Cores (256, 128, 64, 32, 16, 8)
            var colorsValues = [256, 128, 64, 32, 16, 8];
            var selColorIndex = colorDropDown.selection ? colorDropDown.selection.index : 0;
            var targetColors = colorsValues[selColorIndex];

            // D. Obter Local de Saída
            var projPath = app.project.file ? app.project.file.parent.fsName : Folder.desktop.fsName;
            var outputDir = projPath + "/GIF";
            if (locInput.text !== "Padrão (Pasta do Projeto)" && locInput.text !== "") {
                var customFolder = new Folder(locInput.text);
                if (customFolder.exists) {
                    outputDir = customFolder.fsName;
                }
            }

            var outputFolder = new Folder(outputDir);
            if (!outputFolder.exists) outputFolder.create();

            // E. Renderizar na Render Queue temporária
            statusLabel.text = "⏳ Renderizando no After Effects...";
            win.update();

            var tempFolder = new Folder(Folder.temp.fsName + "/ae_gif_export_" + new Date().getTime());
            if (!tempFolder.exists) tempFolder.create();

            var renderQueue = app.project.renderQueue;
            var item = renderQueue.items.add(comp);
            item.timeSpanStart = comp.workAreaStart;
            item.timeSpanDuration = comp.workAreaDuration;

            var outputModule = item.outputModule(1);
            var tempRenderFile = new File(tempFolder.fsName + "/temp_render.[fileextension]");
            outputModule.file = tempRenderFile;

            try {
                renderQueue.render();
            } catch(e) {
                statusLabel.text = "❌ Erro ao renderizar no AE";
                alert("Erro ao renderizar a composição: " + e.toString());
                return;
            }

            // Localizar arquivo temporário
            var tempFiles = tempFolder.getFiles();
            var sourceFile = null;
            if (tempFiles) {
                for (var f = 0; f < tempFiles.length; f++) {
                    if (tempFiles[f] instanceof File) {
                        sourceFile = tempFiles[f].fsName;
                        break;
                    }
                }
            }
            if (!sourceFile) {
                statusLabel.text = "❌ Erro no render temporário";
                alert("Erro: Arquivo temporário de mídia não encontrado.");
                return;
            }

            var sanitizeName = comp.name.replace(/[^a-zA-Z0-9_-]/g, "_");
            var gifFile = new File(outputFolder.fsName + "/" + sanitizeName + ".gif");
            var optFolder = new Folder(outputFolder.fsName + "/Optimized");
            if (!optFolder.exists) optFolder.create();
            var optGifFile = new File(optFolder.fsName + "/" + sanitizeName + "_optimized.gif");
            var paletteFile = new File(tempFolder.fsName + "/palette.png");

            // F. Criar Script Batch em segundo plano
            var batFile = new File(tempFolder.fsName + "/run_bg_gif.bat");
            batFile.open("w");
            batFile.writeln("@echo off");
            batFile.writeln("title Convertendo GIF - " + comp.name);
            batFile.writeln('"' + ffmpegPath + '" -i "' + sourceFile + '" -vf "scale=' + targetWidth + ':-1:flags=lanczos,palettegen=max_colors=' + targetColors + '" -y "' + paletteFile.fsName + '"');
            batFile.writeln('"' + ffmpegPath + '" -i "' + sourceFile + '" -i "' + paletteFile.fsName + '" -filter_complex "fps=' + targetFps + ',scale=' + targetWidth + ':-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle" -y "' + gifFile.fsName + '"');
            
            var lossyVal = targetColors <= 32 ? 100 : 40;
            if (gifsiclePath !== "") {
                batFile.writeln('if exist "' + gifsiclePath + '" ("' + gifsiclePath + '" -o "' + optGifFile.fsName + '" -O3 --lossy=' + lossyVal + ' "' + gifFile.fsName + '")');
            }

            if (openFolderChk.value) {
                batFile.writeln('if exist "' + optGifFile.fsName + '" (explorer.exe /select,"' + optGifFile.fsName.replace(/\//g, "\\") + '") else if exist "' + gifFile.fsName + '" (explorer.exe /select,"' + gifFile.fsName.replace(/\//g, "\\") + '")');
            }

            batFile.close();

            // G. Disparar o BAT em segundo plano 100% desacoplado usando VBScript
            var vbsFile = new File(tempFolder.fsName + "/launch_bg.vbs");
            vbsFile.open("w");
            vbsFile.writeln('Set WshShell = CreateObject("WScript.Shell")');
            vbsFile.writeln('WshShell.Run "cmd /c ""' + batFile.fsName.replace(/\//g, "\\") + '""", 0, False');
            vbsFile.close();

            system.callSystem('wscript.exe "' + vbsFile.fsName.replace(/\//g, "\\") + '"');

            statusLabel.text = "⚡ Conversão em 2º plano! AE Liberado.";
            win.update();
        };

        win.layout.layout(true);
        return win;
    }

    var scriptWindow = buildUI(thisObj);
    if (scriptWindow instanceof Window) {
        scriptWindow.center();
        scriptWindow.show();
    }
})(this);
