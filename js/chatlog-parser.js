﻿$(document).ready(function() {
    let applyBackground = false;
    let applyCensorship = false;
    let censorshipStyle = 'pixelated';
    let characterName = "";
    const $textarea = $("#chatlogInput");
    const $output = $("#output");
    const $toggleBackgroundBtn = $("#toggleBackground");
    const $toggleCensorshipBtn = $("#toggleCensorship");
    const $toggleCensorshipStyleBtn = $("#toggleCensorshipStyle");

    $toggleBackgroundBtn.click(toggleBackground);
    $toggleCensorshipBtn.click(toggleCensorship);
    $toggleCensorshipStyleBtn.click(toggleCensorshipStyle);

    // Add listener for lineLengthInput within the existing ready function
    $("#lineLengthInput").on("input", processOutput);

    $("#characterNameInput").on("input", debounce(applyFilter, 300));

    function toggleBackground() {
        applyBackground = !applyBackground;
        $output.toggleClass("background-active", applyBackground);

        $toggleBackgroundBtn
            .toggleClass("btn-dark", applyBackground)
            .toggleClass("btn-outline-dark", !applyBackground);

        processOutput();
    }

    function toggleCensorship() {
        applyCensorship = !applyCensorship;
        $toggleCensorshipBtn
            .toggleClass("btn-dark", applyCensorship)
            .toggleClass("btn-outline-dark", !applyCensorship);
        processOutput();
    }

    function toggleCensorshipStyle() {
        censorshipStyle = (censorshipStyle === 'blur') ? 'hidden' : 'blur';
        $toggleCensorshipStyleBtn.text(`Tipo de censura: ${censorshipStyle.charAt(0).toUpperCase() + censorshipStyle.slice(1)}`);
        processOutput();
    }

    function applyFilter() {
        characterName = $("#characterNameInput").val().toLowerCase();
        processOutput();
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function throttle(func, limit) {
        let lastFunc, lastRan;
        return function() {
            const context = this;
            const args = arguments;
            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function() {
                    if (Date.now() - lastRan >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    $textarea.off("input").on("input", throttle(processOutput, 200));

    function replaceDashes(text) {
        return text.replace(/(\.{2,3}-|-\.{2,3})/g, '—');
    }

    function processOutput() {
        const chatText = $textarea.val();
        const chatLines = chatText.split("\n")
                                  .map(removeTimestamps)
                                  .map(replaceDashes); // Apply dash replacement
        let fragment = document.createDocumentFragment();

        chatLines.forEach((line) => {
            const div = document.createElement("div");
            div.className = "generated";

            let formattedLine = formatLineWithFilter(line);

            if (applyCensorship) {
                formattedLine = applyCensorshipToLine(formattedLine, line);
            }

            div.innerHTML = addLineBreaksAndHandleSpans(formattedLine);
            fragment.appendChild(div);

            const clearDiv = document.createElement("div");
            clearDiv.className = "clear";
            fragment.appendChild(clearDiv);
        });

        $output.html('');
        $output.append(fragment);
        cleanUp();
    }

    function applyCensorshipToLine(formattedLine, originalLine) {
        const exclusionPatterns = [
            /\[S:\s*\d+\s*\|\s*CH:.*\]/,
            /\[\d{2}\/[A-Z]{3}\/\d{4}\]/,
            /intercom/i
        ];

        if (exclusionPatterns.some((pattern) => pattern.test(originalLine))) {
            return formattedLine;
        }

        const censorshipRules = [
            {
                regex: /(?<!K)\$\d+(?:,\d{3})*\.\d{1,3}/g,
                replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
            },
            {
                regex: /(?<!K)\[\$\d+(?:,\d{3})*\.\d{1,3}\]/g,
                replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
            },
            {
                regex: /(?<!K)\$\d+(?:,\d{3})*(?:\.\d{1,3})?/g,
                replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
            },
            {
                regex: /(?<!K)\(\d+(g)?\)/g,
                replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
            },
            {
                regex: /(?<!K)(?<!<span class="me">[^<]*\s)\d+(?=\s[a-zA-Z]+\b)/g,
                replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
            },
            {
                regex: /(?<!K)#\d+/g,
                replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
            },
            {
                regex: /(?<!K)\[#\d+\]/g,
                replacement: (match) => `<span class="${censorshipStyle}">[#${match.match(/#\d+/)[0].slice(1)}]</span>`
            },
            {
                regex: /(?<!K)(?=.*<span class="blue">)x(\d+)/g,
                replacement: (_match, p1) => `x<span class="${censorshipStyle}">${p1}</span>`
            },
            // Nova Regra - Detectar número seguido de "x" (ex: 1x, 5x)
            {
                regex: /\b\d+x\b/g,
                replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
            },
            // Nova Regra - Detectar exatamente 7 dígitos
            {
                regex: /\b\d{7}\b/g,
                replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
            }
        ];
        
        let censoredLine = formattedLine;
        censorshipRules.forEach(rule => {
            censoredLine = censoredLine.replace(rule.regex, rule.replacement);
        });
        
        return censoredLine;
    }        

    function removeTimestamps(line) {
        return line.replace(/\[\d{2}:\d{2}:\d{2}\] /g, "");
    }

    function formatLineWithFilter(line) {
        const lowerLine = line.toLowerCase();
        const toSectionPattern = /\(to [^)]+\)/i;
        const lineWithoutToSection = line.replace(toSectionPattern, "");

        if (isRadioLine(line)) {
            if (!characterName) {
                return wrapSpan("radioColor", line);
            }
            return lineWithoutToSection.toLowerCase().includes(characterName) ?
                wrapSpan("radioColor", line) :
                wrapSpan("radioColor2", line);
        }

        if (lowerLine.includes("diz (baixo)")) {
            if (!characterName) {
                return wrapSpan("grey", line);
            }
            return lineWithoutToSection.toLowerCase().includes(characterName) ?
                wrapSpan("white", line) :
                wrapSpan("lightgrey", line);
        }   

        if (lowerLine.includes("sussurra:")) {
            if (!characterName) {
                return wrapSpan("yellow", line);
            }
            return lineWithoutToSection.toLowerCase().includes(characterName) ?
                wrapSpan("yellow", line) :
                wrapSpan("whisper", line);
        }

        if (lowerLine.includes("sussurra (veículo):")) {
            if (!characterName) {
                return wrapSpan("yellow", line);
            }
            return lineWithoutToSection.toLowerCase().includes(characterName) ?
                wrapSpan("yellow", line) :
                wrapSpan("whisper", line);
        }
           
        if (lowerLine.includes("diz:") || lowerLine.includes("shouts:")) {
            if (!characterName) {
                return wrapSpan("white", line);
            }
            return lineWithoutToSection.toLowerCase().includes(characterName) ?
                wrapSpan("white", line) :
                wrapSpan("lightgrey", line);
        }   

// Condição 1
if (lowerLine.includes("diz (para")) {
    if (!characterName) {
        return wrapSpan("lightgrey", line); // Caso characterName não seja definido
    }
    const speaker = line.split(" diz (para")[0].trim(); // Extrair o nome de quem está falando
    return speaker.toLowerCase() === characterName.toLowerCase() ?
        wrapSpan("white", line) : // Se for o próprio personagem, branco
        wrapSpan("lightgrey", line); // Caso contrário, cinza claro
}

// Condição 2
if (lowerLine.includes("diz (baixo para")) {
    if (!characterName) {
        return wrapSpan("lightgrey", line); // Caso characterName não seja definido
    }
    const speaker = line.split(" diz (baixo para")[0].trim(); // Extrair o nome de quem está falando
    return speaker.toLowerCase() === characterName.toLowerCase() ?
        wrapSpan("white", line) : // Se for o próprio personagem, cinza claro
        wrapSpan("lightgrey", line); // Caso contrário, cinza escuro
}

        

        return formatLine(line);
    }

    function isRadioLine(line) {
        return /\[S: \d+ \| CH: .+\]/.test(line);
    }

    function formatLine(line) {
        const lowerLine = line.toLowerCase();

        if (line === "********** EMERGENCY CALL **********") {
        return '<span class="blue">' + line + '</span>';
    }

    const emergencyCallPattern = /^(Log Number|Phone Number|Location|Situation):\s*(.*)$/;

    const match = line.match(emergencyCallPattern);

    if (match) {
        const key = match[1];
        const value = match[2];
        return '<span class="blue">' + key + ': </span><span class="white">' + value + '</span>';
    }
        if (/^\*\* \[PRISON PA\].*\*\*$/.test(line)) {
            return formatPrisonPA(line);
        }
        if (/\([^\)]+\) Message from [^:]+: .+/.test(line)) {
            return formatSmsMessage(line);
        }
        if (lowerLine.includes("you've set your main phone to")) return formatPhoneSet(line);
        if (/\*\* Seu .+ está tocando \(PH: .+\)/.test(line)) {
            return formatIncomingCall(line);
        }
        if (lowerLine === 'sua chamada foi atendida.') {    
            return wrapSpan('yellow', line);
        }
        if (lowerLine === 'você desligou a chamada.') {
            return wrapSpan('white', line);
        }
        if (lowerLine === 'a outra parte recusou a chamada.') {
            return wrapSpan('white', line);
        }
        if (lowerLine === 'a outra parte desligou a chamada.') {
            return wrapSpan('yellow', line);
        }
        if (lowerLine.startsWith("[info]")) return colorInfoLine(line);
        if (lowerLine.includes("[ch: vts - vessel traffic service]")) return formatVesselTraffic(line);
        if (/\[[^\]]+ -> [^\]]+\]/.test(line)) return wrapSpan("depColohandleWhispersr", line);
        if (line.startsWith("*")) return wrapSpan("me", line);
        if (line.startsWith(">")) return wrapSpan("ame", line);
        if (lowerLine.includes("(celular) *")) return wrapSpan("me", line);
        if (lowerLine.includes("sussurra:")) return handleWhispers(line);
        if (lowerLine.includes("diz (celular):")) return handleCellphone(line);
        if (
            lowerLine.includes("(goods)") ||
            lowerLine.match(/(.+?)\s+x(\d+)\s+\((\d+g)\)/)
        )
            return handleGoods(line);
        if (lowerLine.includes("[megaphone]:")) return wrapSpan("yellow", line);
        if (lowerLine.includes("(microfone):")) return wrapSpan("yellow", line);
        if (lowerLine.includes("[celular] você atendeu a ligação de")) return wrapSpan("yellow", line);
        if (lowerLine.includes("[celular] você desligou a ligação de")) return wrapSpan("yellow", line);
        if (lowerLine.includes("[celular] sua ligação com")) return wrapSpan("yellow", line);
        if (lowerLine.includes("[celular] você está ligando para")) return wrapSpan("yellow", line);
        if (lowerLine.includes("[celular] sms em")) return wrapSpan("orangesms", line);
        if (lowerLine.includes("[celular] sms para")) return wrapSpan("yellow", line);
        if (lowerLine.includes("[celular] sua ligação para")) return wrapSpan("yellow", line);
        if (lowerLine.includes("(/atender ou /des)")) return wrapSpan("yellow", line);
        if (lowerLine.includes("você aceitou o convite para")) return wrapSpan("green", line);
        if (lowerLine.includes("(/ac 5 para aceitar ou /rc 5 para recusar)")) return wrapSpan("green", line);
        if (lowerLine.includes("[celular] sms de")) return wrapSpan("orangesms", line);
        if (lowerLine.includes("[celular] você recebeu uma localização de")) return wrapSpan("green", line);
        if (lowerLine.includes("sussurra (veículo):")) return wrapSpan("yellow", line);
        if (lowerLine.includes("você está em um mood")) return wrapSpan("salmon", line);
        if (lowerLine.includes("o formigamento no seu corpo")) return wrapSpan("salmon", line);
        if (lowerLine.includes("não importa o que você usou ou a forma que usou")) return wrapSpan("salmon", line);
        if (lowerLine.includes("aceitou seu convite")) return wrapSpan("green", line);
        if (lowerLine.startsWith("info:")) return formatInfo(line);
        if (lowerLine.includes("[drug lab]")) return formatDrugLab();
        if (lowerLine.includes("[character kill]")) return formatCharacterKill(line);
        if (lowerLine.includes("[character kill]")) return formatCharacterKill(line);
        if (lowerLine.includes("você enviou sua localização com sucesso"))return wrapSpan("green", line);
        if (lowerLine.includes("agora suas mensagens ic estarão em tom baixo"))return wrapSpan("green", line);
        if (lowerLine.includes("você abasteceu seu veículo com"))return wrapSpan("green", line);
        if (lowerLine.includes("[anúncio]"))return wrapSpan("greenad", line);
        if (lowerLine.includes("[anúncio de roleplay]"))return wrapSpan("death", line);
        
        if (lowerLine.includes("(( pm de"))return wrapSpan("yellow", line);
        if (lowerLine.includes("[dados]"))return wrapSpan("me", line);
        if (/pegou\s+\d+x\s+.+/i.test(lowerLine)) return wrapSpan("green", line);
        if (lowerLine.includes("você recebeu uma localização de"))return colorLocationLine(line);
        if (
            lowerLine.includes("você está sendo revistado por") ||
            (lowerLine.includes("entregou para você") && /você(?:\s+|\W+|$)(?:\$\d|\d)/.test(lowerLine)) ||
            (lowerLine.includes("pagou") && /pagou(?:\s+|\W+|$)(?:\$\d|\d)/.test(lowerLine)) ||
            (lowerLine.includes("você usou") && /você usou\s+\d+x/i.test(lowerLine))
        )
            return handleTransaction(line);               
        if (lowerLine.includes("você agora está mascarado")) return wrapSpan("green", line);
        if (lowerLine.includes("you have shown your inventory")) return wrapSpan("green", line);
        if (lowerLine.includes("você não está mais mascarado")) return wrapSpan("death", line);
        if (lowerLine.includes("solicitou uma revista em você")) return wrapSpan("green", line);
        if (lowerLine.startsWith("you've cut")) return formatDrugCut(line);
        if (lowerLine.includes("[property robbery]")) return formatPropertyRobbery(line);
        if (/You've just taken .+?! You will feel the effects of the drug soon\./.test(line)) {
            return formatDrugEffect(line);
        }
        if (line.includes("[CASHTAP]")) {
            return formatCashTap(line);
        }

        if (/\+\s?\$\d+/.test(line)) {
            return line.replace(/\+\s?\$(\d+)/g, '<span class="green">+ $1</span>');
        }
        
        if (/-\s?\$\d+/.test(line)) {
            return line.replace(/-\s?\$(\d+)/g, '<span class="salmon">- $1</span>');
        }
        if (/^Pagamento de/.test(line)) {
            return '<span class="grey">' + line + '</span>';
        }
        
        return replaceColorCodes(line);
    }

    function wrapSpan(className, content) {
        return `<span class="${className}">${content}</span>`;
    }

    function handleWhispers(line) {
        return line.startsWith("(Car)") ?
            wrapSpan("yellow", line) :
            wrapSpan("yellow", line);
    }

    function handleCellphone(line) {
        return line.startsWith("!") ?
            wrapSpan('phone', line.slice(1)) :
            wrapSpan("white", line);
    }

    function handleDrug(line) {
        return line.startsWith("&") ?
            wrapSpan('salmon', line.slice(1)) :
            wrapSpan("white", line);
    }

    function handleGoods(line) {
        return wrapSpan(
            "yellow",
            line.replace(/(\$\d+)/, '<span class="green">$1</span>')
        );
    }

    function handleTransaction(line) {
        return (
            '<span class="green">' +
            line.replace(/(\$\d+(?:,\d{3})*(?:\.\d{1,3})?)/g, '<span class="green">$1</span>') +
            "</span>"
        );
    }

    function formatInfo(line) {
        const moneyMatch = line.match(/\$(\d+)/);
        const itemMatch = line.match(/took\s(.+?)\s\((\d+)\)\sfrom\s(the\s.+)\.$/i);

        if (moneyMatch) {
            const objectMatch = line.match(/from the (.+)\.$/i);
            return objectMatch ?
                `<span class="orange">Info:</span> <span class="white">You took</span> <span class="green">$${moneyMatch[1]}</span> <span class="white">from the ${objectMatch[1]}</span>.` :
                line;
        }

        if (itemMatch) {
            const itemName = itemMatch[1];
            const itemQuantity = itemMatch[2];
            const fromObject = itemMatch[3];

            return `<span class="orange">Info:</span> <span class="white">You took</span> <span class="white">${itemName}</span> <span class="white">(${itemQuantity})</span> <span class="white">from ${fromObject}</span>.`;
        }

        return line;
    }

    function formatSmsMessage(line) {
        // Remove any square brackets
        line = line.replace(/[\[\]]/g, '');
        // Wrap the entire line in yellow
        return wrapSpan('yellow', line);
    }

    function formatPhoneSet(line) {
        // Remove any square brackets except for [INFO]
        line = line.replace(/\[(?!INFO\])|\](?!)/g, '');
        // Replace [INFO] with green
        line = line.replace('[INFO]', '<span class="green">[INFO]</span>');
        // The rest is white
        const infoTag = '<span class="green">[INFO]</span>';
        const restOfLine = line.replace(/\[INFO\]/, '').trim();
        return infoTag + ' <span class="white">' + restOfLine + '</span>';
    }

    function formatIncomingCall(line) {
        // Extrair informações com base no formato
        const match = line.match(/\*\* Seu (.+) está tocando \(PH: (.+)\)/);
        if (match) {
            const device = match[1];
            const parenthetical = match[2];
    
            return '<span class="white">** Seu </span><span class="yellow">' + device + '</span><span class="white"> está tocando (PH: ' + parenthetical + ')</span>';
        } else {
            // Se não corresponder, apenas envolve a linha em branco
            return '<span class="white">' + line + '</span>';
        }
    }

    function colorInfoLine(line) {
        // Mantém as chaves e colore apenas [INFO]
        const datePattern = /\[INFO\]/; // Captura exatamente "[INFO]"
        
        // Substitui apenas [INFO] por um span estilizado
        line = line.replace(datePattern, '<span class="pink">[INFO]</span>');
        
        return line; // Retorna a linha modificada
    }    

    function applyPhoneRequestFormatting(line) {
        // Pattern: [INFO] You have received a contact ([anything here], [numbers here]) from [anything here]. Use /acceptnumber to accept it.
        const pattern = /\[INFO\] You have received a contact \((.+), ([^\)]+)\) from (.+)\. Use (\/acceptnumber) to accept it\./;

        const match = line.match(pattern);

        if (match) {
            const contactName = match[1];
            const numbers = match[2];
            const sender = match[3];
            const acceptCommand = match[4];

            return '<span class="green">[INFO]</span> <span class="white">You have received a contact (' + contactName + ', ' + numbers + ') from ' + sender + '. Use ' + acceptCommand + ' to accept it.</span>';
        } else {
            // If no match, just return line
            return line;
        }
    }

    function applyContactShareFormatting(line) {
        // Pattern: [INFO] You have received a contact ([anything here], [numbers here]) from [anything here]. Use /acceptcontact to accept it.
        const pattern = /\[INFO\] You have received a contact \((.+), ([^\)]+)\) from (.+)\. Use (\/acceptcontact) to accept it\./;

        const match = line.match(pattern);

        if (match) {
            const contactName = match[1];
            const numbers = match[2];
            const sender = match[3];
            const acceptCommand = match[4];

            return '<span class="green">[INFO]</span> <span class="white">You have received a contact (' + contactName + ', ' + numbers + ') from ' + sender + '. Use ' + acceptCommand + ' to accept it.</span>';
        } else {
            // If no match, just return line
            return line;
        }
    }

    function applyNumberShareFormatting(line) {
        // Pattern: [INFO] You have shared your number with [anything here] under the name [anything here].
        const pattern = /\[INFO\] You have shared your number with (.+) under the name (.+)\./;

        const match = line.match(pattern);

        if (match) {
            const receiver = match[1];
            const name = match[2];

            return '<span class="green">[INFO]</span> <span class="white">You have shared your number with ' + receiver + ' under the name ' + name + '.</span>';
        } else {
            return line;
        }
    }

    function applyContactSharedFormatting(line) {
        // Pattern: [INFO] You have shared [anything here] ([numbers here]) with [anything here].
        const pattern = /\[INFO\] You have shared (.+) \(([^\)]+)\) with (.+)\./;

        const match = line.match(pattern);

        if (match) {
            const contactName = match[1];
            const numbers = match[2];
            const receiver = match[3];

            return '<span class="green">[INFO]</span> <span class="white">You have shared ' + contactName + ' (' + numbers + ') with ' + receiver + '.</span>';
        } else {
            return line;
        }
    }

    function formatVesselTraffic(line) {
        const vesselTrafficPattern = /\*\*\s*\[CH: VTS - Vessel Traffic Service\]/;

        if (vesselTrafficPattern.test(line)) {
            return `<span class="vesseltraffic">${line}</span>`;
        }

        return line;
    }

    function formatIntercom(line) {
        return line.replace(
            /\[(.*?) intercom\]: (.*)/i,
            '<span class="blue">[$1 Intercom]: $2</span>'
        );
    }

    function formatPhoneCursor(line) {
        return '<span class="white">Use <span class="yellow">/phonecursor (/pc)</span> to activate the cursor to use the phone.</span>';
    }

    function formatShown(line) {
        return `<span class="green">${line.replace(
            /their (.+)\./,
            'their <span class="white">$1</span>.'
        )}</span>`;
    }

    function replaceColorCodes(str) {
        return str
            .replace(
                /\{([A-Fa-f0-9]{6})\}/g,
                (_match, p1) => '<span style="color: #' + p1 + ';">'
            )
            .replace(/\{\/([A-Fa-f0-9]{6})\}/g, "</span>");
    }

    function colorMoneyLine(line) {
        return line
            .replace(
                /You have received (\$\d+(?:,\d{3})*(?:\.\d{1,3})?)/,
                '<span class="white">You have received </span><span class="green">$1</span>'
            )
            .replace(
                /from (.+) on your bank account\./,
                '<span class="white">from </span><span class="white">$1</span><span class="white"> on your bank account.</span>'
            );
    }

    function colorLocationLine(line) {
        return line.replace(
            /(You received a location from) (#\d+)(. Use )(\/removelocation)( to delete the marker\.)/,
            '<span class="green">$1 </span>' +
            '<span class="yellow">$2</span>' +
            '<span class="green">$3</span>' +
            '<span class="death">$4</span>' +
            '<span class="green">$5</span>'
        );
    }

    function formatRobbery(line) {
        return line
            .replace(/\/arob/, '<span class="blue">/arob</span>')
            .replace(/\/report/, '<span class="death">/report</span>')
            .replace(/You're being robbed, use (.+?) to show your inventory/, '<span class="white">You\'re being robbed, use </span><span class="blue">$1</span><span class="white"> to show your inventory</span>');
    }

    function formatDrugLab() {
        return '<span class="orange">[DRUG LAB]</span> <span class="white">Drug production has started.</span>';
    }

    function formatCharacterKill(line) {
        return (
            '<span class="blue">[Character kill]</span> <span class="death">' +
            line.slice(16) +
            "</span>"
        );
    }

    function formatDrugCut(line) {
        const drugCutPattern = /You've cut (.+?) x(\d+) into x(\d+)\./i;
        const match = line.match(drugCutPattern);

        if (match) {
            const drugName = match[1];
            const firstAmount = match[2];
            const secondAmount = match[3];

            return (
                `<span class="white">You've cut </span>` +
                `<span class="blue">${drugName}</span>` +
                `<span class="blue"> x${firstAmount}</span>` +
                `<span class="white"> into </span><span class="blue">x${secondAmount}</span>` +
                `<span class="blue">.</span>`
            );
        }
        return line;
    }

    function formatPropertyRobbery(line) {
        const robberyPattern = /\[PROPERTY ROBBERY\](.*?)(\$[\d,]+)(.*)/;
        const match = line.match(robberyPattern);

        if (match) {
            const textBeforeAmount = match[1];
            const amount = match[2];
            const textAfterAmount = match[3];

            return `<span class="green">[PROPERTY ROBBERY]</span>${textBeforeAmount}<span class="green">${amount}</span>${textAfterAmount}`;
        }

        return line;
    }

    function formatDrugEffect(line) {
        const pattern = /You've just taken (.+?)! You will feel the effects of the drug soon\./;
        const match = line.match(pattern);
    
        if (match) {
            const drugName = match[1];
            return `<span class="white">You've just taken </span><span class="green">${drugName}</span><span class="white">! You will feel the effects of the drug soon.</span>`;
        }
    
        return line;
    }

    function formatPrisonPA(line) {
        const pattern = /^\*\* \[PRISON PA\].*\*\*$/;
        if (pattern.test(line)) {
            return `<span class="blue">${line}</span>`;
        }
        return line;
    }

    function formatCashTap(line) {
        if (line.includes("[CASHTAP]")) {
            return line.replace(
                /\[CASHTAP\]/g,
                '<span class="green">[CASHTAP]</span>'
            ).replace(
                /^(.*?)(<span class="green">\[CASHTAP\]<\/span>)(.*)$/,
                '<span class="white">$1</span>$2<span class="white">$3</span>'
            );
        }
        return line;
    }

    function addLineBreaksAndHandleSpans(text) {
        const maxLineLength = document.getElementById("lineLengthInput").value;
        let result = "";
        let currentLineLength = 0;
        let inSpan = false;
        let currentSpan = "";

        function addLineBreak() {
            if (inSpan) {
                const spanClassMatch = currentSpan.match(/class="([^"]+)"/);
                const spanClass = spanClassMatch ? spanClassMatch[1] : "";
                result += `</span><br><span class="${spanClass}">`;
            } else {
                result += "<br>";
            }
            currentLineLength = 0;
        }

        for (let i = 0; i < text.length; i++) {
            if (text[i] === "<" && text.substr(i, 5) === "<span") {
                let spanEnd = text.indexOf(">", i);
                currentSpan = text.substring(i, spanEnd + 1);
                i = spanEnd;
                inSpan = true;
                result += currentSpan;
            } else if (text[i] === "<" && text.substr(i, 7) === "</span>") {
                inSpan = false;
                result += "</span>";
                i += 6;
            } else {
                result += text[i];
                currentLineLength++;

                if (currentLineLength >= maxLineLength && text[i] === " ") {
                    addLineBreak();
                }
            }
        }

        return result;
    }

    function cleanUp() {
        $output.find(".generated").each(function() {
            let html = $(this).html();
            html = html.replace(/<br>\s*<br>/g, "<br>");
            html = html.replace(/^<br>|<br>$/g, "");
            html = html.replace(/<span[^>]*>\s*<\/span>/g, "");
            $(this).html(html);
        });
        applyStyles();
    }

    function applyStyles() {
        $(".generated").css("background-color", "transparent");

        if (applyBackground) {
            $(".generated").css("background-color", "#000000");
        }
    }

    processOutput();
});

