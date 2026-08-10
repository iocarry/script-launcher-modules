// ============================================================
// MOTION TOOLS CORE C - Property Input & Text Tools
// ============================================================

function buildCoreC_UI(parentPanel, buildSectionHelper, COLORS, mtStatus, memTools) {

    // Color definitions with fallback
    var propColor = COLORS.propertyInput || [1.0, 1.0, 1.0];
    var textColor = COLORS.textTools || COLORS.others || [0.9, 0.4, 0.6];

    // =======================================================
    // 1. UI & LOGIC: PROPERTY INPUT
    // =======================================================
    (function buildPropertyInput() {
        var piCurrentGroup = [];
        var piAvailableProps = [];

        function piGetSelectedTargets() {
            var comp = app.project.activeItem;
            if (!(comp instanceof CompItem)) return [];
            return comp.selectedProperties;
        }

        function piValToStr(val) {
            if (val instanceof Array) {
                var parts = [];
                for (var i = 0; i < val.length; i++) parts.push(Math.round(val[i] * 100) / 100);
                return parts.join(", ");
            } else if (typeof val === "number") {
                return String(Math.round(val * 100) / 100);
            } else {
                return String(val);
            }
        }

        function piValsEqual(a, b) {
            if (a instanceof Array && b instanceof Array) {
                if (a.length !== b.length) return false;
                for (var i = 0; i < a.length; i++) { if (Math.abs(a[i] - b[i]) > 0.001) return false; }
                return true;
            }
            if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.001;
            return String(a) === String(b);
        }

        function piFormatCurrentValue(propGroup) {
            try {
                var comp = app.project.activeItem;
                var firstVal = propGroup[0].valueAtTime(comp.time, false);
                var allSame = true;
                for (var i = 1; i < propGroup.length; i++) {
                    var v = propGroup[i].valueAtTime(comp.time, false);
                    if (!piValsEqual(firstVal, v)) { allSame = false; break; }
                }
                if (!allSame) return "\u2014 m\u00faltiplos valores (" + propGroup.length + " layers)";
                return piValToStr(firstVal) + (propGroup.length > 1 ? "  [\u00d7" + propGroup.length + "]" : "");
            } catch (e) { return "\u2014"; }
        }

        function piSolveMath(expr, currVal) {
            var s = expr.replace(/\s/g, ""); if (s === "") return null;
            if (s.charAt(0) === '+' || s.charAt(0) === '*' || s.charAt(0) === '/') s = String(currVal) + s;
            s = s.replace(/,/g, ".");
            try { var res = eval(s); return isNaN(res) ? null : Number(res); } catch (e) { return null; }
        }

        function piParseInput(rawText, prop, baseVal) {
            var text = rawText.replace(/\s/g, ""); if (text === "") return null;
            var currentVal = (baseVal !== undefined) ? baseVal : prop.valueAtTime(app.project.activeItem.time, false);
            if (currentVal instanceof Array) {
                var parts = rawText.split(","); var result = [];
                if (parts.length === 1) {
                    var singleCheck = piSolveMath(parts[0], currentVal[0]); if (singleCheck === null) return null;
                    for (var i = 0; i < currentVal.length; i++) { var v1 = piSolveMath(parts[0], currentVal[i]); result.push(v1 !== null ? v1 : currentVal[i]); }
                } else {
                    for (var j = 0; j < currentVal.length; j++) {
                        if (j < parts.length && parts[j].replace(/\s/g, "") !== "") { var v2 = piSolveMath(parts[j], currentVal[j]); result.push(v2 !== null ? v2 : currentVal[j]); }
                        else { result.push(currentVal[j]); }
                    }
                }
                return result;
            } else if (typeof currentVal === "number") { var v3 = piSolveMath(rawText, currentVal); return v3 !== null ? v3 : null; }
            else { if (text === "true") return true; if (text === "false") return false; return rawText; }
        }

        var piPanel = buildSectionHelper(parentPanel, "Property Input", propColor[0], propColor[1], propColor[2], true);
        piPanel.margins = [6, 4, 6, 6];

        var piTopGrp = piPanel.add("group"); piTopGrp.orientation = "column"; piTopGrp.alignChildren = ["fill", "center"]; piTopGrp.spacing = 4;
        var piDdlProps = piTopGrp.add("dropdownlist", undefined, ["Nenhuma sele\u00e7\u00e3o"]); piDdlProps.selection = 0; piDdlProps.alignment = ["fill", "center"];
        var piLblValue = piTopGrp.add("statictext", undefined, ""); piLblValue.justify = "center"; piLblValue.alignment = ["fill", "center"]; piLblValue.graphics.font = ScriptUI.newFont("dialog", "BOLD", 10);

        var piInputGrp = piPanel.add("group"); piInputGrp.orientation = "row"; piInputGrp.alignChildren = ["fill", "center"]; piInputGrp.spacing = 4;
        var piInputField = piInputGrp.add("edittext", undefined, ""); piInputField.preferredSize = [120, 24]; piInputField.helpTip = "Ex: 1920/2, +50, *2";
        var piBtnApply = piInputGrp.add("button", undefined, "\u2713"); piBtnApply.preferredSize = [28, 24];

        var piLblStatus = piPanel.add("statictext", undefined, "Selecione um Efeito"); piLblStatus.justify = "center"; piLblStatus.alignment = ["fill", "center"];
        var piBtnRefresh = piPanel.add("button", undefined, "\u21bb  Puxar Op\u00e7\u00f5es"); piBtnRefresh.preferredSize = [-1, 22];

        function piUpdateValueText() { if (piCurrentGroup && piCurrentGroup.length > 0) piLblValue.text = "Atual: " + piFormatCurrentValue(piCurrentGroup); else piLblValue.text = ""; }

        var PI_SKIP_NAMES = {
            "Blending Mode": true, "Blend Mode": true, "Composite": true,
            "Preserve Underlying Transparency": true, "Casts Shadows": true,
            "Accepts Shadows": true, "Accepts Lights": true
        };

        function piCollectEditableProps(group, outProps, outNames) {
            for (var i = 1; i <= group.numProperties; i++) {
                var child = group.property(i);
                if (child.propertyType === PropertyType.PROPERTY) {
                    if (PI_SKIP_NAMES[child.name]) continue;
                    try {
                        var pvt = child.propertyValueType;
                        if (pvt === PropertyValueType.CUSTOM_VALUE || pvt === PropertyValueType.NONE) continue;
                    } catch(e) {}
                    outProps.push(child);
                    outNames.push(child.name);
                }
            }
        }

        function piRefreshPropInfo() {
            piAvailableProps = []; var tempNames = []; var selItems = piGetSelectedTargets();

            if (selItems.length > 0) {
                var hasDirectProps = false;
                var nameIndex = {};

                for (var si = 0; si < selItems.length; si++) {
                    var item = selItems[si];
                    if (item.propertyType === PropertyType.PROPERTY) {
                        hasDirectProps = true;
                        if (PI_SKIP_NAMES[item.name]) continue;
                        try {
                            var pvt2 = item.propertyValueType;
                            if (pvt2 === PropertyValueType.CUSTOM_VALUE || pvt2 === PropertyValueType.NONE) continue;
                        } catch(e) {}

                        var nm = item.name;
                        if (nameIndex.hasOwnProperty(nm)) {
                            piAvailableProps[nameIndex[nm]].push(item);
                        } else {
                            nameIndex[nm] = piAvailableProps.length;
                            piAvailableProps.push([item]);
                            tempNames.push(nm);
                        }
                    }
                }

                if (!hasDirectProps) {
                    for (var gi = 0; gi < selItems.length; gi++) {
                        var grpItem = selItems[gi];
                        if (grpItem.propertyType === PropertyType.NAMED_GROUP || grpItem.propertyType === PropertyType.INDEXED_GROUP) {
                            var tmpP = [], tmpN = [];
                            piCollectEditableProps(grpItem, tmpP, tmpN);
                            for (var ci = 0; ci < tmpP.length; ci++) {
                                piAvailableProps.push([tmpP[ci]]);
                                tempNames.push(tmpN[ci]);
                            }
                            break;
                        }
                    }
                }
            }

            piDdlProps.removeAll();
            if (piAvailableProps.length > 0) {
                for (var j = 0; j < tempNames.length; j++) piDdlProps.add("item", tempNames[j]);
                piDdlProps.selection = 0; piCurrentGroup = piAvailableProps[0]; piLblStatus.text = "\u270f\ufe0f Digite a conta.";
            } else {
                piDdlProps.add("item", "Nenhuma sele\u00e7\u00e3o"); piDdlProps.selection = 0;
                piCurrentGroup = []; piLblStatus.text = "\u26A0 Selecione Efeito/Propriedade.";
            }
            piUpdateValueText();
            try { var root = parentPanel; while (root.parent) root = root.parent; if (root.layout) root.layout.layout(true); } catch(e){}
        }

        function piApplyValue() {
            if (!piCurrentGroup || piCurrentGroup.length === 0) { piLblStatus.text = "\u26A0 Puxe uma propriedade."; return; }
            var raw = piInputField.text;
            try {
                app.beginUndoGroup("PropertyInput");
                var totalCount = 0;

                for (var pi = 0; pi < piCurrentGroup.length; pi++) {
                    var prop = piCurrentGroup[pi];
                    var selectedKeys = prop.selectedKeys;

                    if (selectedKeys && selectedKeys.length > 0) {
                        for (var i = 0; i < selectedKeys.length; i++) {
                            var keyIdx = selectedKeys[i];
                            var keyBase = prop.keyValue(keyIdx);
                            var newVal = piParseInput(raw, prop, keyBase);
                            if (newVal === null) continue;
                            prop.setValueAtKey(keyIdx, newVal);
                            totalCount++;
                        }
                    } else {
                        var newVal2 = piParseInput(raw, prop);
                        if (newVal2 === null) continue;
                        if (prop.isTimeVarying) { prop.setValueAtTime(app.project.activeItem.time, newVal2); }
                        else { prop.setValue(newVal2); }
                        totalCount++;
                    }
                }

                app.endUndoGroup();
                if (totalCount > 0) {
                    piLblStatus.text = "\u2713 " + totalCount + " alterado(s) em " + piCurrentGroup.length + " layer(s).";
                } else {
                    piLblStatus.text = "\u26A0 Valor inv\u00e1lido.";
                }
                piUpdateValueText();
                piInputField.active = false; piInputField.active = true;
            } catch(e) { app.endUndoGroup(); piLblStatus.text = "\u2717 Erro: " + e.message; }
        }

        piDdlProps.onChange = function() { if (piDdlProps.selection && piAvailableProps.length > 0) { piCurrentGroup = piAvailableProps[piDdlProps.selection.index]; piUpdateValueText(); } };
        piInputField.addEventListener("keydown", function(event) { if (event.keyName === "Enter") { piApplyValue(); event.preventDefault(); } });
        piBtnApply.onClick = piApplyValue; piBtnRefresh.onClick = function() { piRefreshPropInfo(); };

        piRefreshPropInfo();
    })();

    // =======================================================
    // 2. UI & LOGIC: TEXT TOOLS (TEXT SPLITTER & JOIN)
    // =======================================================
    (function buildTextTools() {
        var secText = buildSectionHelper(parentPanel, "Text Tools", textColor[0], textColor[1], textColor[2], true);
        secText.margins = [6, 4, 6, 6];

        // Options Row
        var optsGroup = secText.add("group");
        optsGroup.orientation = "row";
        optsGroup.alignChildren = ["center", "center"];
        optsGroup.alignment = ["fill", "center"];
        optsGroup.spacing = 6;

        var centerAnchorChk = optsGroup.add("checkbox", undefined, "Center Anchor");
        var addNullChk      = optsGroup.add("checkbox", undefined, "Add Null");
        var colorLabelsChk  = optsGroup.add("checkbox", undefined, "Colors");
        colorLabelsChk.value = true;

        // Split Buttons Row
        var btnGroup = secText.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignChildren = ["fill", "center"];
        btnGroup.alignment = ["fill", "center"];
        btnGroup.spacing = 4;

        var letterBtn = btnGroup.add("button", undefined, "Letters");
        var wordBtn   = btnGroup.add("button", undefined, "Words");
        var lineBtn   = btnGroup.add("button", undefined, "Lines");
        letterBtn.preferredSize[1] = wordBtn.preferredSize[1] = lineBtn.preferredSize[1] = 24;

        // Join Row
        var joinGroup = secText.add("group");
        joinGroup.orientation = "row";
        joinGroup.alignChildren = ["fill", "center"];
        joinGroup.alignment = ["fill", "center"];

        var joinBtn = joinGroup.add("button", undefined, "🔗  Join Selected Text");
        joinBtn.preferredSize[1] = 24;

        // Event Handlers
        letterBtn.onClick = function () { runTextSplit("letters", centerAnchorChk.value, addNullChk.value, colorLabelsChk.value, mtStatus); };
        wordBtn.onClick   = function () { runTextSplit("words",   centerAnchorChk.value, addNullChk.value, colorLabelsChk.value, mtStatus); };
        lineBtn.onClick   = function () { runTextSplit("lines",   centerAnchorChk.value, addNullChk.value, colorLabelsChk.value, mtStatus); };
        joinBtn.onClick   = function () { runTextJoin(mtStatus); };

        // ---------------------------------------------------
        // TEXT SPLIT & JOIN LOGIC
        // ---------------------------------------------------
        var JUST_TAG = "TS_JUST=";

        function measureInk(comp, doc, text) {
            var temp = comp.layers.addText(text);
            try {
                var tDoc = temp.property("Source Text").value;
                tDoc.font = doc.font;
                tDoc.fontSize = doc.fontSize;
                tDoc.tracking = doc.tracking;
                tDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
                temp.property("Source Text").setValue(tDoc);
                var rect = temp.sourceRectAtTime(comp.time, false);
                return rect.width;
            } finally {
                temp.remove();
            }
        }

        function measureAdvance(comp, doc, text) {
            if (text.length === 0) return 0;
            var withText = measureInk(comp, doc, "|" + text + "|");
            var guidesOnly = measureInk(comp, doc, "||");
            return withText - guidesOnly;
        }

        function justificationToString(just) {
            if (just === ParagraphJustification.CENTER_JUSTIFY) return "center";
            if (just === ParagraphJustification.RIGHT_JUSTIFY) return "right";
            return "left";
        }

        function stringToJustification(str) {
            if (str === "center") return ParagraphJustification.CENTER_JUSTIFY;
            if (str === "right") return ParagraphJustification.RIGHT_JUSTIFY;
            return ParagraphJustification.LEFT_JUSTIFY;
        }

        function readOriginalJustification(layer) {
            var c = layer.comment;
            if (!c) return null;
            var idx = c.indexOf(JUST_TAG);
            if (idx < 0) return null;
            var val = c.substring(idx + JUST_TAG.length);
            val = val.replace(/[\s\r\n].*$/, "");
            return stringToJustification(val);
        }

        function getLineStartX(justification, lineWidth) {
            if (justification === ParagraphJustification.CENTER_JUSTIFY) return -lineWidth / 2;
            if (justification === ParagraphJustification.RIGHT_JUSTIFY) return -lineWidth;
            return 0;
        }

        function unitLayerName(unitText) {
            var trimmed = unitText.replace(/^\s+|\s+$/g, "");
            return (trimmed.length > 0) ? trimmed : "(espa\u00e7o)";
        }

        function transformOffset(dx, dy, scaleX, scaleY, rotationDeg) {
            var sx = dx * (scaleX / 100.0);
            var sy = dy * (scaleY / 100.0);
            var r = rotationDeg * Math.PI / 180.0;
            var cos = Math.cos(r);
            var sin = Math.sin(r);
            return [sx * cos - sy * sin, sx * sin + sy * cos];
        }

        function createUnitLayer(sourceLayer, unitText, xOffset, yOffset, centerAnchor, addNull, comp, forceLeftJustify, label) {
            var newLayer = sourceLayer.duplicate();
            var newDoc = newLayer.property("Source Text").value;
            var originalJust = newDoc.justification;
            newDoc.text = unitText;
            if (forceLeftJustify) {
                newDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
            }
            newLayer.property("Source Text").setValue(newDoc);
            newLayer.name = unitLayerName(unitText);
            newLayer.label = (label !== undefined) ? label : 8;
            newLayer.comment = JUST_TAG + justificationToString(originalJust);

            var scaleVal = sourceLayer.property("Scale").value;
            var scaleX = scaleVal[0];
            var scaleY = scaleVal[1];
            var rotationDeg = sourceLayer.property("Rotation").value;
            var off = transformOffset(xOffset, yOffset, scaleX, scaleY, rotationDeg);
            var posProp = newLayer.property("Position");
            var basePos = sourceLayer.property("Position").value;
            var alignedPos = (basePos.length === 3)
                ? [basePos[0] + off[0], basePos[1] + off[1], basePos[2]]
                : [basePos[0] + off[0], basePos[1] + off[1]];
            posProp.setValue(alignedPos);

            if (centerAnchor) {
                var anchorProp = newLayer.property("Anchor Point");
                var oldAnchor = anchorProp.value;
                var rect = newLayer.sourceRectAtTime(comp.time, false);
                var centerX = rect.left + rect.width / 2;
                var centerY = rect.top + rect.height / 2;
                var newAnchor = (oldAnchor.length === 3) ? [centerX, centerY, oldAnchor[2]] : [centerX, centerY];
                var anchorDelta = transformOffset(newAnchor[0] - oldAnchor[0], newAnchor[1] - oldAnchor[1], scaleX, scaleY, rotationDeg);
                anchorProp.setValue(newAnchor);
                alignedPos = (alignedPos.length === 3)
                    ? [alignedPos[0] + anchorDelta[0], alignedPos[1] + anchorDelta[1], alignedPos[2]]
                    : [alignedPos[0] + anchorDelta[0], alignedPos[1] + anchorDelta[1]];
                posProp.setValue(alignedPos);
            }

            if (addNull) {
                var nullLayer = comp.layers.addNull();
                nullLayer.name = "NULL - " + newLayer.name;
                nullLayer.label = 9;
                var nullPosProp = nullLayer.property("Position");
                var nullPosValue = (nullPosProp.value.length === 3)
                    ? [alignedPos[0], alignedPos[1], (alignedPos.length === 3 ? alignedPos[2] : nullPosProp.value[2])]
                    : [alignedPos[0], alignedPos[1]];
                nullPosProp.setValue(nullPosValue);
                newLayer.parent = nullLayer;
                var zeroPos = (posProp.value.length === 3) ? [0, 0, 0] : [0, 0];
                posProp.setValue(zeroPos);
            }
            return { unit: newLayer, nul: (addNull ? nullLayer : null) };
        }

        function splitTextLayer(layer, mode, comp, centerAnchor, addNull, useColors) {
            var textProp = layer.property("Source Text");
            var doc = textProp.value;
            var fullText = doc.text;
            var lineHeight = (!doc.autoLeading && doc.leading > 0) ? doc.leading : doc.fontSize * 1.2;
            var lines = fullText.split(/\r/);
            var pairs = [];
            var colorIndex = 0;

            for (var li = 0; li < lines.length; li++) {
                var lineText = lines[li];
                var yOffset = li * lineHeight;
                if (mode === "lines") {
                    if (lineText.length === 0) continue;
                    var lineLabel = useColors ? (colorIndex % 16) + 1 : 8;
                    colorIndex++;
                    pairs.push(createUnitLayer(layer, lineText, 0, yOffset, centerAnchor, addNull, comp, false, lineLabel));
                    continue;
                }
                var lineWidth = measureAdvance(comp, doc, lineText);
                var lineStartX = getLineStartX(doc.justification, lineWidth);

                if (mode === "words") {
                    var tokens = lineText.split(/(\s+)/);
                    var cursor = 0;
                    for (var wi = 0; wi < tokens.length; wi++) {
                        var token = tokens[wi];
                        if (token.length > 0 && !/^\s+$/.test(token)) {
                            var prefix = lineText.substring(0, cursor);
                            var xOffset = lineStartX + measureAdvance(comp, doc, prefix);
                            var wordLabel = useColors ? (colorIndex % 16) + 1 : 8;
                            colorIndex++;
                            pairs.push(createUnitLayer(layer, token, xOffset, yOffset, centerAnchor, addNull, comp, true, wordLabel));
                        }
                        cursor += token.length;
                    }
                    continue;
                }

                if (mode === "letters") {
                    var wordRanges = [];
                    var ci2 = 0;
                    while (ci2 < lineText.length) {
                        if (!/\s/.test(lineText.charAt(ci2))) {
                            var wStart = ci2;
                            while (ci2 < lineText.length && !/\s/.test(lineText.charAt(ci2))) ci2++;
                            var wLabel = useColors ? (colorIndex % 16) + 1 : 8;
                            colorIndex++;
                            wordRanges.push({ start: wStart, end: ci2 - 1, label: wLabel });
                        } else {
                            ci2++;
                        }
                    }
                    for (var ci = 0; ci < lineText.length; ci++) {
                        var ch = lineText.charAt(ci);
                        if (/\s/.test(ch)) continue;
                        var prefix2 = lineText.substring(0, ci);
                        var xOffset2 = lineStartX + measureAdvance(comp, doc, prefix2);
                        var charLabel = 1;
                        for (var wr = 0; wr < wordRanges.length; wr++) {
                            if (ci >= wordRanges[wr].start && ci <= wordRanges[wr].end) {
                                charLabel = wordRanges[wr].label;
                                break;
                            }
                        }
                        pairs.push(createUnitLayer(layer, ch, xOffset2, yOffset, centerAnchor, addNull, comp, true, charLabel));
                    }
                    continue;
                }
            }

            for (var i = 0; i < pairs.length; i++) {
                var p = pairs[i];
                p.unit.moveToBeginning();
                if (p.nul) p.nul.moveToBeginning();
            }
            layer.enabled = false;
        }

        function invTransformOffset(dx, dy, scaleX, scaleY, rotationDeg) {
            var r = -rotationDeg * Math.PI / 180.0;
            var cos = Math.cos(r);
            var sin = Math.sin(r);
            var xr = dx * cos - dy * sin;
            var yr = dx * sin + dy * cos;
            return [xr / (scaleX / 100.0), yr / (scaleY / 100.0)];
        }

        function layerTextOrigin(layer, comp) {
            var pos = layer.property("Position").value;
            var anchor = layer.property("Anchor Point").value;
            var scaleVal = layer.property("Scale").value;
            var rotationDeg = layer.property("Rotation").value;
            var doc = layer.property("Source Text").value;

            var firstLine = doc.text.split(/\r/)[0];
            var lineW = measureAdvance(comp, doc, firstLine);
            var startOffsetText = getLineStartX(doc.justification, lineW);
            var startShift = transformOffset(startOffsetText, 0, scaleVal[0], scaleVal[1], rotationDeg);
            var rotScaledAnchor = transformOffset(anchor[0], anchor[1], scaleVal[0], scaleVal[1], rotationDeg);

            var localOrigin = [
                pos[0] - rotScaledAnchor[0] + startShift[0],
                pos[1] - rotScaledAnchor[1] + startShift[1]
            ];

            var parent = layer.parent;
            if (parent === null) return localOrigin;

            var pPos = parent.property("Position").value;
            var pAnchor = parent.property("Anchor Point").value;
            var pScale = parent.property("Scale").value;
            var pRot = parent.property("Rotation").value;
            var rel = transformOffset(localOrigin[0] - pAnchor[0], localOrigin[1] - pAnchor[1], pScale[0], pScale[1], pRot);
            return [pPos[0] + rel[0], pPos[1] + rel[1]];
        }

        function joinTextLayers(comp, textLayers) {
            var baseLayer = textLayers[0];
            var baseDoc = baseLayer.property("Source Text").value;
            var refScale = baseLayer.property("Scale").value;
            var refRotation = baseLayer.property("Rotation").value;
            var spaceAdvance = measureAdvance(comp, baseDoc, " ");
            if (spaceAdvance <= 0) spaceAdvance = baseDoc.fontSize * 0.25;
            var lineHeight = (!baseDoc.autoLeading && baseDoc.leading > 0) ? baseDoc.leading : baseDoc.fontSize * 1.2;

            var items = [];
            for (var i = 0; i < textLayers.length; i++) {
                var lyr = textLayers[i];
                var origin = layerTextOrigin(lyr, comp);
                items.push({ layer: lyr, origin: origin, text: lyr.property("Source Text").value.text });
            }
            var ref = items[0].origin;
            for (var i = 0; i < items.length; i++) {
                var d = invTransformOffset(items[i].origin[0] - ref[0], items[i].origin[1] - ref[1], refScale[0], refScale[1], refRotation);
                items[i].tx = d[0];
                items[i].ty = d[1];
                items[i].lineNo = Math.round(d[1] / lineHeight);
            }

            items.sort(function (a, b) {
                if (a.lineNo !== b.lineNo) return a.lineNo - b.lineNo;
                return a.tx - b.tx;
            });

            var minLine = items[0].lineNo;
            var maxLine = items[items.length - 1].lineNo;
            var result = "";

            for (var line = minLine; line <= maxLine; line++) {
                if (line > minLine) result += "\r";
                var inLine = [];
                for (var i = 0; i < items.length; i++) {
                    if (items[i].lineNo === line) inLine.push(items[i]);
                }
                if (inLine.length === 0) continue;

                var cursorX = inLine[0].tx;
                for (var k = 0; k < inLine.length; k++) {
                    var it = inLine[k];
                    if (k === 0) {
                        result += it.text;
                        cursorX = it.tx + measureAdvance(comp, baseDoc, it.text);
                    } else {
                        var gap = it.tx - cursorX;
                        var nSpaces = Math.round(gap / spaceAdvance);
                        if (nSpaces < 0) nSpaces = 0;
                        var spaces = "";
                        for (var s = 0; s < nSpaces; s++) spaces += " ";
                        result += spaces + it.text;
                        cursorX = it.tx + measureAdvance(comp, baseDoc, it.text);
                    }
                }
            }

            var restoredJust = null;
            for (var i = 0; i < textLayers.length; i++) {
                var oj = readOriginalJustification(textLayers[i]);
                if (oj !== null) { restoredJust = oj; break; }
            }
            if (restoredJust === null) restoredJust = baseDoc.justification;

            var mergedLayer = baseLayer.duplicate();
            var mergedDoc = mergedLayer.property("Source Text").value;
            mergedDoc.text = result;
            mergedDoc.justification = restoredJust;
            mergedLayer.property("Source Text").setValue(mergedDoc);
            mergedLayer.name = result.length > 30 ? result.substring(0, 30) + "..." : result;
            mergedLayer.label = baseLayer.label;
            mergedLayer.enabled = true;
            mergedLayer.comment = "";

            var firstLine = result.split(/\r/)[0];
            var firstLineWidth = measureAdvance(comp, baseDoc, firstLine);
            var originShiftText = 0;
            if (restoredJust === ParagraphJustification.CENTER_JUSTIFY) {
                originShiftText = firstLineWidth / 2;
            } else if (restoredJust === ParagraphJustification.RIGHT_JUSTIFY) {
                originShiftText = firstLineWidth;
            }
            var mergedScale = mergedLayer.property("Scale").value;
            var mergedRotation = mergedLayer.property("Rotation").value;
            var originShift = transformOffset(originShiftText, 0, mergedScale[0], mergedScale[1], mergedRotation);
            var refOrigin = items[0].origin;
            var targetOrigin = [refOrigin[0] + originShift[0], refOrigin[1] + originShift[1]];

            var mergedAnchor = mergedLayer.property("Anchor Point").value;
            var anchorShift = transformOffset(mergedAnchor[0], mergedAnchor[1], mergedScale[0], mergedScale[1], mergedRotation);
            var mergedPosProp = mergedLayer.property("Position");
            var mergedPosVal = mergedPosProp.value;
            var newMergedPos = (mergedPosVal.length === 3)
                ? [targetOrigin[0] + anchorShift[0], targetOrigin[1] + anchorShift[1], mergedPosVal[2]]
                : [targetOrigin[0] + anchorShift[0], targetOrigin[1] + anchorShift[1]];
            mergedPosProp.setValue(newMergedPos);

            var mAnchorProp = mergedLayer.property("Anchor Point");
            var mOldAnchor = mAnchorProp.value;
            var mRect = mergedLayer.sourceRectAtTime(comp.time, false);
            var mCenterX = mRect.left + mRect.width / 2;
            var mCenterY = mRect.top + mRect.height / 2;
            var mNewAnchor = (mOldAnchor.length === 3) ? [mCenterX, mCenterY, mOldAnchor[2]] : [mCenterX, mCenterY];
            var mAnchorDelta = transformOffset(mNewAnchor[0] - mOldAnchor[0], mNewAnchor[1] - mOldAnchor[1], mergedScale[0], mergedScale[1], mergedRotation);
            mAnchorProp.setValue(mNewAnchor);
            var mPosAfter = mergedPosProp.value;
            var mPosCompensated = (mPosAfter.length === 3)
                ? [mPosAfter[0] + mAnchorDelta[0], mPosAfter[1] + mAnchorDelta[1], mPosAfter[2]]
                : [mPosAfter[0] + mAnchorDelta[0], mPosAfter[1] + mAnchorDelta[1]];
            mergedPosProp.setValue(mPosCompensated);

            for (var i = 0; i < textLayers.length; i++) {
                var parentNull = textLayers[i].parent;
                textLayers[i].remove();
                if (parentNull !== null) {
                    try { parentNull.remove(); } catch (e) {}
                }
            }
            return mergedLayer;
        }

        function runTextSplit(mode, centerAnchor, addNull, useColors, statusObj) {
            var comp = app.project.activeItem;
            if (!(comp && comp instanceof CompItem)) {
                alert("Abra uma composi\u00e7\u00e3o antes de rodar o script.");
                return;
            }
            var sel = comp.selectedLayers;
            var textLayers = [];
            for (var i = 0; i < sel.length; i++) {
                if (sel[i] instanceof TextLayer) textLayers.push(sel[i]);
            }
            if (textLayers.length === 0) {
                alert("Selecione ao menos uma camada de texto.");
                return;
            }
            app.beginUndoGroup("Split Text (" + mode + ")");
            try {
                for (var j = 0; j < textLayers.length; j++) {
                    splitTextLayer(textLayers[j], mode, comp, centerAnchor, addNull, useColors);
                }
                if (statusObj) statusObj.text = "\u2713 Split (" + mode + ") conclu\u00eddo!";
            } catch (e) {
                alert("Erro: " + e.toString());
                if (statusObj) statusObj.text = "\u26A0 Erro no Split.";
            } finally {
                app.endUndoGroup();
            }
        }

        function runTextJoin(statusObj) {
            var comp = app.project.activeItem;
            if (!(comp && comp instanceof CompItem)) {
                alert("Abra uma composi\u00e7\u00e3o antes de rodar o script.");
                return;
            }
            var sel = comp.selectedLayers;
            var textLayers = [];
            for (var i = 0; i < sel.length; i++) {
                if (sel[i] instanceof TextLayer) textLayers.push(sel[i]);
            }
            if (textLayers.length < 2) {
                alert("Selecione ao menos duas camadas de texto para unir.");
                return;
            }
            app.beginUndoGroup("Join Text Layers");
            try {
                joinTextLayers(comp, textLayers);
                if (statusObj) statusObj.text = "\u2713 Textos unidos com sucesso!";
            } catch (e) {
                alert("Erro: " + e.toString());
                if (statusObj) statusObj.text = "\u26A0 Erro no Join.";
            } finally {
                app.endUndoGroup();
            }
        }
    })();
}
