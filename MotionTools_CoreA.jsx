// ============================================================
// MOTION TOOLS CORE A - Nulls, Loop e Dynamics (CEP Engine)
// ============================================================

var SL_CORE_A = (function() {
    
    function getWorldPosition(layer) {
        var ap = layer.anchorPoint.value;
        try { return layer.toWorld(ap); } catch(e) { return layer.position.value; }
    }

    function getLayerWorldBounds(comp, layer) {
        var rect;
        try { rect = layer.sourceRectAtTime(comp.time, false); } catch(e) { return null; }
        if (!rect) return null;
        var l = rect.left, t = rect.top, w = rect.width, h = rect.height;
        var corners = [[l, t], [l + w, t], [l + w, t + h], [l, t + h]];
        var minX = Infinity, minY = Infinity;
        var maxX = -Infinity, maxY = -Infinity;
        for (var i = 0; i < corners.length; i++) {
            var wpt;
            try { wpt = layer.toWorld(corners[i]); } catch(e) { return null; }
            if (wpt[0] < minX) minX = wpt[0]; if (wpt[0] > maxX) maxX = wpt[0];
            if (wpt[1] < minY) minY = wpt[1]; if (wpt[1] > maxY) maxY = wpt[1];
        }
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, cx: (minX + maxX) * 0.5, cy: (minY + maxY) * 0.5, w: maxX - minX, h: maxY - minY };
    }

    function createNullLayer(comp, name, pos, size, is3D, inPoint, outPoint) {
        var nullLayer = comp.layers.addNull(); nullLayer.name = name; nullLayer.label = 1;
        if (is3D) nullLayer.threeDLayer = true;
        nullLayer.anchorPoint.setValue(is3D ? [50, 50, 0] : [50, 50]); nullLayer.position.setValue(pos);
        if (inPoint !== undefined) nullLayer.inPoint = inPoint; if (outPoint !== undefined) nullLayer.outPoint = outPoint;
        return nullLayer;
    }

    function createShapeNull(comp, name, pos, size, is3D, inPoint, outPoint) {
        var shapeLayer = comp.layers.addShape(); shapeLayer.name = name; shapeLayer.guideLayer = true; shapeLayer.label = 1;
        var shapeGroup = shapeLayer.property("ADBE Root Vectors Group");
        var rect = shapeGroup.addProperty("ADBE Vector Shape - Rect"); rect.property("ADBE Vector Rect Size").setValue([100, 100]);
        var stroke = shapeGroup.addProperty("ADBE Vector Graphic - Stroke"); stroke.property("ADBE Vector Stroke Color").setValue([1, 0, 0, 1]); stroke.property("ADBE Vector Stroke Width").setValue(2);
        if (is3D) shapeLayer.threeDLayer = true;
        shapeLayer.anchorPoint.setValue(is3D ? [0, 0, 0] : [0, 0]); shapeLayer.position.setValue(pos);
        if (inPoint !== undefined) shapeLayer.inPoint = inPoint; if (outPoint !== undefined) shapeLayer.outPoint = outPoint;
        return shapeLayer;
    }

    function createControlLayer(comp, name, pos, size, is3D, useRealNull, inPoint, outPoint) {
        if (useRealNull) return createNullLayer(comp, name, pos, size, is3D, inPoint, outPoint);
        return createShapeNull(comp, name, pos, size, is3D, inPoint, outPoint);
    }

    function nullOneForAll(comp, selectedLayers, useRealNull, forceCompCenter) {
        var nullPos, is3D, minIn, maxOut;
        if (forceCompCenter) {
            is3D = false; minIn = Infinity; maxOut = -Infinity;
            nullPos = [comp.width / 2, comp.height / 2];
            if (selectedLayers.length > 0) {
                for (var ti = 0; ti < selectedLayers.length; ti++) {
                    if (selectedLayers[ti].inPoint < minIn) minIn = selectedLayers[ti].inPoint;
                    if (selectedLayers[ti].outPoint > maxOut) maxOut = selectedLayers[ti].outPoint;
                }
            } else {
                minIn = comp.workAreaStart;
                maxOut = comp.workAreaStart + comp.workAreaDuration;
            }
        } else {
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            is3D = false; var sumZ = 0, countZ = 0; minIn = Infinity; maxOut = -Infinity;
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                if (layer.threeDLayer) is3D = true;
                if (layer.inPoint < minIn) minIn = layer.inPoint;
                if (layer.outPoint > maxOut) maxOut = layer.outPoint;
                var bounds = getLayerWorldBounds(comp, layer);
                if (bounds) {
                    if (bounds.minX < minX) minX = bounds.minX; if (bounds.maxX > maxX) maxX = bounds.maxX;
                    if (bounds.minY < minY) minY = bounds.minY; if (bounds.maxY > maxY) maxY = bounds.maxY;
                } else {
                    var wp = getWorldPosition(layer);
                    if (wp[0] < minX) minX = wp[0]; if (wp[0] > maxX) maxX = wp[0];
                    if (wp[1] < minY) minY = wp[1]; if (wp[1] > maxY) maxY = wp[1];
                }
                if (layer.threeDLayer) { sumZ += layer.position.value[2]; countZ++; }
            }
            var cx = (minX + maxX) * 0.5, cy = (minY + maxY) * 0.5;
            var cz = countZ > 0 ? sumZ / countZ : 0; nullPos = is3D ? [cx, cy, cz] : [cx, cy];
        }
        var nullSize = [0, 0];
        var nullLayer = createControlLayer(comp, "NULL", nullPos, nullSize, is3D, useRealNull, minIn, maxOut);
        if (selectedLayers.length > 0) {
            var topIndex = selectedLayers[0].index;
            for (var j = 1; j < selectedLayers.length; j++) { if (selectedLayers[j].index < topIndex) topIndex = selectedLayers[j].index; }
            nullLayer.moveBefore(comp.layer(topIndex));
            for (var k = 0; k < selectedLayers.length; k++) { selectedLayers[k].parent = nullLayer; }
        }
        return nullLayer;
    }

    function nullOnePerLayer(comp, selectedLayers, useRealNull, forceCompCenter) {
        for (var i = selectedLayers.length - 1; i >= 0; i--) {
            var layer = selectedLayers[i]; var is3D = layer.threeDLayer; var nullPos, nullSize;
            if (forceCompCenter) {
                nullPos = is3D ? [comp.width / 2, comp.height / 2, 0] : [comp.width / 2, comp.height / 2]; nullSize = null;
            } else {
                var bounds = getLayerWorldBounds(comp, layer);
                if (bounds) {
                    nullPos = is3D ? [bounds.cx, bounds.cy, layer.position.value[2]] : [bounds.cx, bounds.cy]; nullSize = [bounds.w, bounds.h];
                } else {
                    var wp = getWorldPosition(layer); nullPos = is3D ? wp : [wp[0], wp[1]]; nullSize = null;
                }
            }
            var nullLayer = createControlLayer(comp, "NULL_" + layer.name, nullPos, nullSize, is3D, useRealNull, layer.inPoint, layer.outPoint);
            nullLayer.moveBefore(layer); layer.parent = nullLayer;
        }
    }

    return {
        runNullAction: function(mode, useRealNullStr, forceCompCenterStr) {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) { return "ERR:Abra uma composição primeiro."; }
            var useRealNull = (useRealNullStr === "true" || useRealNullStr === true);
            var forceCompCenter = (forceCompCenterStr === "true" || forceCompCenterStr === true);
            
            var selected = [];
            for (var i = 1; i <= comp.numLayers; i++) { if (comp.layer(i).selected) selected.push(comp.layer(i)); }
            var useCompCenter = forceCompCenter || (selected.length === 0);
            if (selected.length === 0) mode = "one_for_all";
            var typeLabel = useRealNull ? "Null" : "Shape";
            
            app.beginUndoGroup("MotionTools: Create " + typeLabel);
            if (mode === "one_for_all") {
                nullOneForAll(comp, selected, useRealNull, useCompCenter);
                app.endUndoGroup();
                return selected.length === 0 ? "✔ " + typeLabel + " no centro da comp." : "✔ " + typeLabel + " criado e layers parentadas.";
            } else {
                nullOnePerLayer(comp, selected, useRealNull, useCompCenter);
                app.endUndoGroup();
                return "✔ " + selected.length + " " + typeLabel + "(s) criado(s).";
            }
        },

        applyLoopExpression: function(loopType) {
            var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) return "ERR:Abra uma composição primeiro.";
            var LOOP_EXPRESSIONS = { 
                cycle: 'loopIn("cycle") + loopOut("cycle") - value', 
                pingpong: 'loopIn("pingpong") + loopOut("pingpong") - value', 
                offset: 'loopIn("offset") + loopOut("offset") - value', 
                cont: 'loopIn("continue") + loopOut("continue") - value' 
            };
            var expr = LOOP_EXPRESSIONS[loopType];
            if (!expr) return "ERR:Tipo de loop inválido.";

            var props = [], warnings = 0;
            function collectSelectedProps(propGroup, result) {
                for (var i = 1; i <= propGroup.numProperties; i++) {
                    var prop = propGroup.property(i);
                    if (prop.propertyType === PropertyType.PROPERTY) {
                        if (prop.selected && prop.canSetExpression) result.push(prop);
                    } else if (prop.propertyType === PropertyType.INDEXED_GROUP || prop.propertyType === PropertyType.NAMED_GROUP) {
                        collectSelectedProps(prop, result);
                    }
                }
            }

            for (var i = 1; i <= comp.numLayers; i++) { 
                var layer = comp.layer(i); 
                if (!layer.selected) continue; 
                collectSelectedProps(layer, props); 
            }
            if (props.length === 0) return "ERR:Selecione propriedades animadas.";

            app.beginUndoGroup("MotionTools: Loop");
            for (var j = 0; j < props.length; j++) {
                if (props[j].numKeys < 1) { warnings++; continue; }
                try { props[j].expression = expr; } catch(e) { warnings++; }
            }
            app.endUndoGroup();
            var applied = props.length - warnings;
            return "✔ Loop " + loopType + ": " + applied + " prop(s).";
        },

        applyElasticExpression: function() {
            var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) return "ERR:Abra uma composição primeiro.";
            var selectedProps = comp.selectedProperties; if (selectedProps.length === 0) return "ERR:Selecione ao menos 1 propriedade.";
            app.beginUndoGroup("MotionTools: Elastic (Kleaner Pro)");
            var appliedCount = 0;
            try {
                for (var i = 0; i < selectedProps.length; i++) {
                    var prop = selectedProps[i];
                    if (prop.canSetExpression) {
                        var layer = prop.propertyGroup(prop.propertyDepth); 
                        var effectsGroup = layer.property("ADBE Effect Parade");
                        function addSlider(name, value) { 
                            var slider = effectsGroup.property(name); 
                            if (!slider) { 
                                slider = effectsGroup.addProperty("ADBE Slider Control"); 
                                slider.name = name; 
                                slider.property(1).setValue(value); 
                            } 
                        }
                        function addCheckbox(name, value) {
                            var cb = effectsGroup.property(name);
                            if (!cb) {
                                cb = effectsGroup.addProperty("ADBE Checkbox Control");
                                cb.name = name;
                                cb.property(1).setValue(value);
                            }
                        }
                        addSlider("Elasticidade (Forca da Mola)", 10); 
                        addSlider("Amortecimento (Freio da Mola)", 50); 
                        addCheckbox("Habilitar Antecipacao", 1);
                        addSlider("Antecipacao - Tempo (Frames)", 12);

                        var expr = "(function() {\n" +
                            "try {\n" +
                            "var p = thisProperty;\n" +
                            "var l = thisLayer;\n" +
                            "var c = thisComp;\n" +
                            "var fxElasticity = 10;\n" +
                            "var fxDamping = 50;\n" +
                            "var fxAntEnable = 1;\n" +
                            "var fxAntFrames = 12;\n" +
                            "try { fxElasticity = l.effect('Elasticidade (Forca da Mola)')(1).value; } catch(e){}\n" +
                            "try { fxDamping = l.effect('Amortecimento (Freio da Mola)')(1).value; } catch(e){}\n" +
                            "try { fxAntEnable = l.effect('Habilitar Antecipacao')(1).value; } catch(e){}\n" +
                            "try { fxAntFrames = l.effect('Antecipacao - Tempo (Frames)')(1).value; } catch(e){}\n" +
                            "var elasticity = fxElasticity / 10;\n" +
                            "var damping = fxDamping / 10;\n" +
                            "var fd = c.frameDuration;\n" +
                            "if (!p || p.numKeys < 2) return value;\n" +
                            "var result = value;\n" +
                            "var isArr = (value instanceof Array);\n" +
                            "var len = isArr ? value.length : 1;\n" +
                            "var threshold = 0.001;\n" +
                            "if (elasticity > 0) {\n" +
                            "var curVel = p.velocityAtTime(time);\n" +
                            "var spd = isArr ? length(curVel) : Math.abs(curVel);\n" +
                            "if (spd < threshold) {\n" +
                            "var nk = p.nearestKey(time);\n" +
                            "if (nk.index > 1) {\n" +
                            "var pk = (nk.time <= time) ? nk : p.key(nk.index - 1);\n" +
                            "var ft = time - pk.time;\n" +
                            "if (ft > 0) {\n" +
                            "var vel = p.velocityAtTime(pk.time - fd);\n" +
                            "var dmp = Math.exp(ft * damping);\n" +
                            "var sin1 = Math.sin(elasticity * ft * 2 * Math.PI);\n" +
                            "sin1 = 0.3 / elasticity * sin1 / dmp;\n" +
                            "if (isArr) {\n" +
                            "var tmp = [];\n" +
                            "for (var i = 0; i < len; i++) tmp[i] = value[i] + (vel[i] / 2) * sin1;\n" +
                            "result = tmp;\n" +
                            "} else {\n" +
                            "result = value + (vel / 2) * sin1;\n" +
                            "}\n" +
                            "}\n" +
                            "}\n" +
                            "}\n" +
                            "}\n" +
                            "if (fxAntEnable > 0 && fxAntFrames > 0 && p.numKeys >= 2) {\n" +
                        "var curVel2 = p.velocityAtTime(time);\n" +
                        "var spd2 = isArr ? length(curVel2) : Math.abs(curVel2);\n" +
                        "if (spd2 < threshold) {\n" +
                        "var nk2 = p.nearestKey(time);\n" +
                        "var nextK = null;\n" +
                        "if (nk2.time > time) nextK = nk2;\n" +
                        "else if (nk2.index < p.numKeys) nextK = p.key(nk2.index + 1);\n" +
                        "if (nextK !== null && nextK.index < p.numKeys) {\n" +
                        "var antDur = fxAntFrames * fd;\n" +
                        "var aStart = nextK.time - antDur;\n" +
                        "if (time >= aStart && time < nextK.time) {\n" +
                        "var prog = (time - aStart) / antDur;\n" +
                        "var vOut = p.velocityAtTime(nextK.time + fd / 10);\n" +
                        "var multiplier = prog * prog * (prog - 1) * antDur;\n" +
                        "if (isArr) {\n" +
                        "var ar = [];\n" +
                        "for (var j = 0; j < len; j++) {\n" +
                        "var vJ = (vOut instanceof Array) ? (vOut[j] || 0) : vOut;\n" +
                        "ar[j] = result[j] + vJ * multiplier;\n" +
                        "}\n" +
                        "result = ar;\n" +
                        "} else {\n" +
                        "result = result + vOut * multiplier;\n" +
                        "}\n" +
                        "}\n" +
                        "}\n" +
                        "}\n" +
                        "}\n" +
                            "return result;\n" +
                            "} catch (err) {\n" +
                            "return value;\n" +
                            "}\n" +
                            "})();";
                        prop.expression = expr; 
                        appliedCount++;
                    }
                }
            } catch(err) {}
            app.endUndoGroup();
            return "✔ Elastic Pro: " + appliedCount + " prop(s).";
        },

        applyBounceExpression: function() {
            var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) return "ERR:Abra uma composição primeiro.";
            var selectedProps = comp.selectedProperties; if (selectedProps.length === 0) return "ERR:Selecione ao menos 1 propriedade.";
            app.beginUndoGroup("MotionTools: Bounce");
            var appliedCount = 0;
            try {
                for (var i = 0; i < selectedProps.length; i++) {
                    var prop = selectedProps[i];
                    if (prop.canSetExpression) {
                        var layer = prop.propertyGroup(prop.propertyDepth); 
                        var effectsGroup = layer.property("ADBE Effect Parade");
                        function addSlider(name, value) { 
                            var slider = effectsGroup.property(name); 
                            if (!slider) { slider = effectsGroup.addProperty("ADBE Slider Control"); slider.name = name; slider.property(1).setValue(value); } 
                        }
                        addSlider("Bounce Elasticity", 70); 
                        addSlider("Bounce Gravity", 5000); 
                        addSlider("Bounce Max", 9);         
                        var expr = "try {\r" +
                            "  var e = effect('Bounce Elasticity')(1) / 100;\r" +
                            "  var g = effect('Bounce Gravity')(1);\r" +
                            "  var nMax = effect('Bounce Max')(1);\r" +
                            "  var n = 0;\r" +
                            "  if (numKeys > 0) {\r" +
                            "    n = nearestKey(time).index;\r" +
                            "    if (key(n).time > time) n--;\r" +
                            "  }\r" +
                            "  var t = (n == 0) ? 0 : time - key(n).time;\r" +
                            "  if (n > 0 && t < 3) {\r" +
                            "    var v = -velocityAtTime(key(n).time - thisComp.frameDuration/10);\r" +
                            "    var vl = length(v);\r" +
                            "    var vu = 0;\r" +
                            "    if (value instanceof Array) {\r" +
                            "      vu = (vl > 0) ? normalize(v) : (value.length == 2 ? [0,1] : [0,1,0]);\r" +
                            "    } else {\r" +
                            "      vu = (v < 0) ? -1 : 1;\r" +
                            "    }\r" +
                            "    var tCur = 0;\r" +
                            "    var segDur = 2 * vl / g;\r" +
                            "    var tNext = segDur;\r" +
                            "    var nb = 1;\r" +
                            "    while (tNext < t && nb <= nMax) {\r" +
                            "      vl *= e;\r" +
                            "      segDur *= e;\r" +
                            "      tCur = tNext;\r" +
                            "      tNext += segDur;\r" +
                            "      nb++;\r" +
                            "    }\r" +
                            "    if (nb <= nMax) {\r" +
                            "      var delta = t - tCur;\r" +
                            "      value + vu * (delta * vl - g * delta * delta / 2);\r" +
                            "    } else {\r" +
                            "      value;\r" +
                            "    }\r" +
                            "  } else {\r" +
                            "    value;\r" +
                            "  }\r" +
                            "} catch(err) { value; }";
                        prop.expression = expr; appliedCount++;
                    }
                }
            } catch(err) {}
            app.endUndoGroup();
            return "✔ Bounce aplicado em " + appliedCount + " prop(s).";
        },

        runSmartOverlap: function() {
            var comp = app.project.activeItem;
            if (!comp || !(comp instanceof CompItem)) return "ERR:Abra uma composição primeiro.";
            var selLayers = comp.selectedLayers;
            if (selLayers.length < 2) return "ERR:Selecione pelo menos 2 layers (a do topo é Master).";

            var master = selLayers[0];
            var followers = [];
            for (var i = 1; i < selLayers.length; i++) followers.push(selLayers[i]);

            var animatedProps = [];
            function findAnimated(propGroup) {
                for (var i = 1; i <= propGroup.numProperties; i++) {
                    var p = propGroup.property(i);
                    if (p.propertyType === PropertyType.PROPERTY) {
                        if (p.parentProperty && p.parentProperty.name === "Overlap Offset") continue;
                        var hasKeys = p.numKeys > 0;
                        var hasExpr = p.canSetExpression && p.expression !== "";
                        if (hasKeys || hasExpr) animatedProps.push(p);
                    } else if (p.numProperties > 0) {
                        findAnimated(p);
                    }
                }
            }
            findAnimated(master);
            if (animatedProps.length === 0) return "ERR:A layer Master não possui Keyframes/Expressões.";

            function getExtendScriptPath(prop) {
                var path = []; var p = prop;
                while (p != null && p.propertyDepth > 0) {
                    if (p.parentProperty && p.parentProperty.matchName === "ADBE Effect Parade") path.unshift(p.name);
                    else path.unshift(p.matchName);
                    p = p.parentProperty;
                }
                return path;
            }

            function getExpressionPath(prop) {
                var str = ""; var p = prop;
                while (p != null && p.propertyDepth > 0) {
                    str = '("' + p.name.replace(/"/g, '\\"') + '")' + str;
                    p = p.parentProperty;
                }
                return str;
            }

            function getEquivalentProperty(targetLayer, pathArray) {
                var target = targetLayer;
                for (var i = 0; i < pathArray.length; i++) {
                    if (target == null) return null;
                    target = target.property(pathArray[i]);
                }
                return target;
            }

            app.beginUndoGroup("MotionTools: Smart Overlap");
            var masterLabel = Math.floor(Math.random() * 16) + 1;
            var followerLabel = Math.floor(Math.random() * 16) + 1;
            while (followerLabel === masterLabel) followerLabel = Math.floor(Math.random() * 16) + 1;
            master.label = masterLabel;
            for (var j = 0; j < followers.length; j++) followers[j].label = followerLabel;

            var effectsGroup = master.property("ADBE Effect Parade");
            var sliderEffect = effectsGroup.property("Overlap Offset");
            if (!sliderEffect) {
                sliderEffect = effectsGroup.addProperty("ADBE Slider Control");
                sliderEffect.name = "Overlap Offset";
                sliderEffect.property("ADBE Slider Control-0001").setValue(2);
            }

            function copyPasteEffect(effectToCopy, targetLayer) {
                for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
                master.selected = true;
                var selProps = master.selectedProperties;
                for (var p = selProps.length - 1; p >= 0; p--) { try { selProps[p].selected = false; } catch(e) {} }
                effectToCopy.selected = true;
                app.executeCommand(19);
                master.selected = false;
                targetLayer.selected = true;
                app.executeCommand(20);
                var tProps = targetLayer.selectedProperties;
                for (var tp = tProps.length - 1; tp >= 0; tp--) { try { tProps[tp].selected = false; } catch(e) {} }
            }

            var propsAppliedCount = 0;
            var autoCopiedEffects = 0;

            for (var pt = 0; pt < animatedProps.length; pt++) {
                var selectedProp = animatedProps[pt];
                var isEffect = false; var effectName = ""; var topGroup = selectedProp;
                while (topGroup.parentProperty != null) {
                    if (topGroup.parentProperty.matchName === "ADBE Effect Parade") {
                        isEffect = true; effectName = topGroup.name; break;
                    }
                    topGroup = topGroup.parentProperty;
                }

                var extPath = getExtendScriptPath(selectedProp);
                var exprPath = getExpressionPath(selectedProp);

                for (var f = 0; f < followers.length; f++) {
                    var follower = followers[f];
                    var multiplier = f + 1;

                    var lastPropMatchName = extPath[extPath.length - 1];
                    if (lastPropMatchName === "ADBE Position_0" || lastPropMatchName === "ADBE Position_1" || lastPropMatchName === "ADBE Position_2") {
                        try {
                            var fPos = follower.property("ADBE Transform Group").property("ADBE Position");
                            if (fPos && fPos.dimensionsSeparated === false) fPos.dimensionsSeparated = true;
                        } catch(e) {}
                    }

                    if (isEffect) {
                        var followerHasEffect = false;
                        var followerEffects = follower.property("ADBE Effect Parade");
                        if (followerEffects) {
                            for (var e = 1; e <= followerEffects.numProperties; e++) {
                                if (followerEffects.property(e).name === effectName) { followerHasEffect = true; break; }
                            }
                        }
                        if (!followerHasEffect) {
                            var masterEffect = master.property("ADBE Effect Parade").property(effectName);
                            if (masterEffect) { copyPasteEffect(masterEffect, follower); autoCopiedEffects++; }
                        }
                    }

                    var followerProp = getEquivalentProperty(follower, extPath);
                    if (followerProp && followerProp.canSetExpression) {
                        var expr = "var master = thisComp.layer(\"" + master.name.replace(/"/g, '\\"') + "\");\n";
                        expr += "var delayFrames = master.effect(\"Overlap Offset\")(\"Slider\");\n";
                        expr += "var delayTime = delayFrames * thisComp.frameDuration * " + multiplier + ";\n";
                        expr += "master" + exprPath + ".valueAtTime(time - delayTime);";
                        followerProp.expression = expr;
                        if (f === 0) propsAppliedCount++;
                    }
                }
            }

            for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
            for (var s = 0; s < selLayers.length; s++) selLayers[s].selected = true;

            app.endUndoGroup();
            return "✔ Overlap: " + propsAppliedCount + " prop(s) em " + followers.length + " layers.";
        }
    };
})();
