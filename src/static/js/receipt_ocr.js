const fileInput = document.getElementById('receipt-image');
const preview = document.getElementById('receipt-preview');
const readButton = document.getElementById('read-receipt');
const status = document.getElementById('ocr-status');

fileInput.addEventListener('change', function () {
    const file = fileInput.files[0];

    if (!file) return;

    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
});

// レシート画像の前処理
async function preprocessReceipt(file) {
    const image = await createImageBitmap(file);

    const scale = 3.0;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const ctx = canvas.getContext('2d', {
        willReadFrequently: true
    });

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const gray = new Uint8Array(width * height);

    for (let i = 0; i < pixels.length; i += 4) {
        gray[i / 4] = Math.round(
            0.299 * pixels[i] +
            0.587 * pixels[i + 1] +
            0.114 * pixels[i + 2]
        );
    }

    const grayCanvas = document.createElement('canvas');
    grayCanvas.width = width;
    grayCanvas.height = height;

    const grayCtx = grayCanvas.getContext('2d');
    const grayImageData = grayCtx.createImageData(width, height);

    for (let i = 0; i < gray.length; i++) {
        const index = i * 4;
        const value = gray[i];
        
        grayImageData.data[index] = value;
        grayImageData.data[index + 1] = value;
        grayImageData.data[index + 2] = value;
        grayImageData.data[index + 3] = 255;
    }

    grayCtx.putImageData(grayImageData, 0, 0);

    const stride = width + 1;
    const integral = new Float64Array(stride * (height + 1));

    for (let y = 0; y < height; y++) {
        let rowSum = 0;

        for (let x = 0; x < width; x++) {
            rowSum += gray[y * width + x];

            integral[(y + 1) * stride + (x + 1)] =
            integral[y * stride + (x + 1)] + rowSum;
        }
    }

    const radius = 18;
    const offset = 10;

    const binaryCanvas = document.createElement('canvas');
    binaryCanvas.width = width;
    binaryCanvas.height = height;

    const binaryCtx = binaryCanvas.getContext('2d');
    const binaryImageData = binaryCtx.createImageData(width, height);
    
    for (let y = 0; y < height; y++) {
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(height - 1, y + radius);

        for (let x = 0; x < width; x ++) {
            const x0 = Math.max(0, x - radius);
            const x1 = Math.min(width - 1, x + radius);

            const sum =
            integral[(y1 + 1) * stride + (x1 + 1)]
            - integral[y0 * stride + (x1 + 1)]
            - integral[(y1 + 1) * stride + x0]
            + integral[y0 * stride + x0];

            const area = (x1 - x0 + 1) * (y1 -y0 + 1);
            const localMean = sum / area;
            const threshold = localMean - offset;

            const value =
            gray[y * width + x] < threshold ? 0 : 255;

            const index = (y * width + x) * 4;

            binaryImageData.data[index] = value;
            binaryImageData.data[index + 1] = value;
            binaryImageData.data[index + 2] = value;
            binaryImageData.data[index + 3] = 255;
        }
    }

    binaryCtx.putImageData(binaryImageData, 0, 0);

    image.close();

    return {grayCanvas, binaryCanvas};
}

// 食品商品名の判定
function isFoodProductName(name) {
    const normalized = name.replace(/\s+/g, '');

    // 商品名ではない可能性が高い文字列を除外
    const excludePatterns = [
        /%引/,
        /割引/,
        /値引/,
        /税込/,
        /税抜/,
        /合計/,
        /小計/,
        /円$/,
        /^[0-9.,¥￥]+$/,
        /^[0-9]+個$/
    ];

    if (excludePatterns.some(pattern => pattern.test(normalized))) {
        return false;
    }

    // 日本語が含まれていない行は除外
    if (!/[ぁ-んァ-ヶ一-龠]/.test(normalized)) {
        return false;
    }

    // 短すぎる・長すぎる行を除外
    if (normalized.length < 3 || normalized.length > 40) {
        return false;
    }

    // 食品関連キーワード
    const foodKeywords = [
        '野菜', '果物', '肉', '牛肉', '豚肉', '鶏肉',
        '魚', '刺身', '卵', '豆腐', '納豆', '米',
        'ご飯', 'おにぎり', '弁当', 'パン', '麺',
        'うどん', 'そば', 'ラーメン', 'パスタ',
        'カレー', '惣菜', 'サラダ', 'スープ',
        'ソーセージ', 'ハム', 'チーズ', 'ヨーグルト',
        '菓子', 'チョコ', 'ポテトチップス', 'じゃがりこ',
        'クッキー', 'ビスケット', 'アイス', 'グミ',
        'せんべい', 'スナック', 'ジュース', 'お茶',
        '緑茶', '紅茶', 'コーヒー', '牛乳', '飲料',
        '調味料', '醤油', 'しょうゆ', '味噌', 'みそ',
        'ソース', 'ドレッシング', '砂糖', '塩',
        '冷凍食品', 'レトルト'
    ];

    // 食品キーワードがあれば食品候補として扱う
    // キーワードがなくても、日本語の商品名らしければ候補に残す
    return true;
}


// 1文字ごとの幅・高さ・文字間隔を測定する
function getCharacterMetrics(data, line) {
    if (!line || !data.symbols) return null;

    const symbols = line.words
        .flatMap(word => word.symbols || [])
        .filter(symbol => {
            const box = symbol.bbox;
            const centerY = (box.y0 + box.y1) / 2;

            return (
                symbol.text.trim() !== '' &&
                centerY >= line.bbox.y0 &&
                centerY <= line.bbox.y1
            );
        })
        .sort((a, b) => a.bbox.x0 - b.bbox.x0);

    if (symbols.length < 2) return null;

    const widths = [];
    const heights = [];
    const gaps = [];

    for (let i = 0; i < symbols.length; i++) {
        const box = symbols[i].bbox;

        widths.push(box.x1 - box.x0);
        heights.push(box.y1 - box.y0);

        if (i > 0) {
            const previous = symbols[i - 1].bbox;
            const gap = box.x0 - previous.x1;

            if (gap >= 0) gaps.push(gap);
        }
    }

    function median(values) {
        if (!values.length) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);

        return sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return {
        characterCount: symbols.length,
        medianWidth: median(widths),
        medianHeight: median(heights),
        medianGap: median(gaps),
        medianPitch: median(widths) + median(gaps)
    };
}


readButton.addEventListener('click', async function () {
    const file = fileInput.files[0];

    if (!file) {
        status.textContent = '先にレシート画像を選択してください。';
        return;
    }

    readButton.disabled = true;

    let worker = null;

    try {
        status.textContent = 'OCRエンジンを準備しています...';

        worker = await Tesseract.createWorker('jpn+eng');

        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            preserve_interword_spaces: '1',
            load_system_dawg: '0',
            load_freq_dawg: '0'
        });
        
        status.textContent = '画像を調整しています...';
        const processedImages = await preprocessReceipt(file);

        status.textContent = 'グレースケール画像を読み取っています...';
        const grayResult = await worker.recognize(
            processedImages.grayCanvas
        );

        status.textContent = '二値化画像を読み取っています...';
        const binaryResult = await worker.recognize(
            processedImages.binaryCanvas
        );

        // 2種類のOCR結果を比較できるようにする
        console.log('【グレースケールOCR】', grayResult.data.text);
        console.log('【二値化OCR】', binaryResult.data.text);

        const result = grayResult;

        const ocrLines = result.data.lines;
        const dateLine = ocrLines.find(line =>
            /20\d{2}.*\d{1,2}.*月.*\d{1,2}.*日/.test(line.text)
        );

        const totalLine = ocrLines.find(line =>
            /[¥￥]\s*[\d,.]+/.test(line.text)
            && line.bbox.y0 > (dateLine ? dateLine.bbox.y1 : 0)
        );
        let productOcrText = '';

        if (dateLine && totalLine) {

            const cropTop = dateLine.bbox.y1;
            const cropBottom = totalLine.bbox.y0;

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = processedImages.grayCanvas.width;
            cropCanvas.height = cropBottom - cropTop;

            const cropCtx = cropCanvas.getContext('2d');

            cropCtx.drawImage(
                processedImages.grayCanvas,
                0, cropTop,
                processedImages.grayCanvas.width, 
                cropBottom - cropTop,
                0, 0,
                cropCanvas.width, cropCanvas.height
            );

            await worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN,
                preserve_interword_spaces: '1'
            });

            const productResult = await worker.recognize(cropCanvas);

            // 住所の文字サイズ・間隔を測定
            const addressLine = result.data.lines.find(line =>
                /兵庫県|神戸市/.test(line.text)
            );

            console.log(
                '【住所の文字サイズ・間隔】',
                getCharacterMetrics(addressLine)
            );

            // 商品欄の文字サイズ・間隔を測定
            console.log('【商品欄の文字サイズ・間隔】');

            for (const line of productResult.data.lines) {
                console.log(
                    line.text,
                    getCharacterMetrics(line)
                );
            }
            
            console.log('【商品欄全体のOCR】', productResult.data.text);

            await worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
                preserve_interword_spaces: '1'
            });

            const rowResults = [];
            const priceResults = [];

            const splitPosition = Math.round(cropCanvas.width * 0.62);
            const priceStart = Math.round(cropCanvas.width * 0.62);


            for (const line of productResult.data.lines) {
            const paddingY = 16;

            const y0 = Math.max(0, Math.floor(line.bbox.y0 - paddingY));
            const y1 = Math.min(cropCanvas.height, Math.ceil(line.bbox.y1 + paddingY));

            const rowHeight = y1 - y0;

            if (rowHeight <= 0) continue;

                        
            const fullRowCanvas = document.createElement('canvas');
            fullRowCanvas.width = cropCanvas.width;
            fullRowCanvas.height = rowHeight;

            const fullRowCtx = fullRowCanvas.getContext('2d');

            fullRowCtx.drawImage(
                cropCanvas,
                0, y0,
                cropCanvas.width, rowHeight,
                0, 0,
                fullRowCanvas.width, fullRowCanvas.height
            );

            // 1行全体をOCR
            const fullRowResult = await worker.recognize(fullRowCanvas);
            const fullRowText = fullRowResult.data.text.trim();

            if (fullRowText) {
                console.log('【1行全体】', fullRowText);
            }

            const leftCanvas = document.createElement('canvas');
            leftCanvas.width = splitPosition;
            leftCanvas.height = rowHeight;

            const leftCtx = leftCanvas.getContext('2d');

            leftCtx.drawImage(
                cropCanvas,
                0, y0,
                splitPosition, rowHeight,
                0, 0,
                leftCanvas.width, leftCanvas.height
            );

            const rightCanvas = document.createElement('canvas');
            rightCanvas.width = cropCanvas.width - priceStart;
            rightCanvas.height = rowHeight;

            const rightCtx = rightCanvas.getContext('2d');

            rightCtx.drawImage(
                cropCanvas,
                priceStart, y0,
                rightCanvas.width, rowHeight,
                0, 0,
                rightCanvas.width, rowHeight
            );

            const scale = 2;

            // ① 元画像を拡大
            const grayCanvas = document.createElement('canvas');
            grayCanvas.width = leftCanvas.width * scale;
            grayCanvas.height = leftCanvas.height * scale;

            const grayCtx = grayCanvas.getContext('2d');
            grayCtx.imageSmoothingEnabled = false;
            grayCtx.drawImage(
                leftCanvas, 0, 0,
                grayCanvas.width, grayCanvas.height
            );

            // ② コントラスト強調画像
            const contrastCanvas = document.createElement('canvas');
            contrastCanvas.width = grayCanvas.width;
            contrastCanvas.height = grayCanvas.height;

            const contrastCtx = contrastCanvas.getContext('2d');
            contrastCtx.drawImage(grayCanvas, 0, 0);

            const contrastData = contrastCtx.getImageData(
                0, 0, contrastCanvas.width, contrastCanvas.height
            );

            const pixels = contrastData.data;

            for (let i = 0; i < pixels.length; i += 4) {
                const value = Math.max(
                    0,
                    Math.min(255, (pixels[i] - 128) * 1.5 + 128)
                );

                pixels[i] = value;
                pixels[i + 1] = value;
                pixels[i + 2] = value;
            }

            contrastCtx.putImageData(contrastData, 0, 0);

            // ③ 適応的二値化画像
            const binaryCanvas = document.createElement('canvas');
            binaryCanvas.width = grayCanvas.width;
            binaryCanvas.height = grayCanvas.height;

            const binaryCtx = binaryCanvas.getContext('2d');
            binaryCtx.drawImage(grayCanvas, 0, 0);

            const binaryData = binaryCtx.getImageData(
                0, 0, binaryCanvas.width, binaryCanvas.height
            );

            const binaryPixels = binaryData.data;
            const width = binaryCanvas.width;
            const height = binaryCanvas.height;

            const gray = new Uint8Array(width * height);
            const integral = new Float64Array((width + 1) * (height + 1));

            for (let i = 0; i < gray.length; i++) {
                gray[i] = binaryPixels[i * 4];
            }

            for (let y = 1; y <= height; y++) {
                let rowSum = 0;

                for (let x = 1; x <= width; x++) {
                    rowSum += gray[(y - 1) * width + x - 1];
                    integral[y * (width + 1) + x] =
                        integral[(y - 1) * (width + 1) + x] + rowSum;
                }
            }

            const radius = 18;
            const offset = 10;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const x0 = Math.max(0, x - radius);
                    const y0 = Math.max(0, y - radius);
                    const x1 = Math.min(width - 1, x + radius);
                    const y1 = Math.min(height - 1, y + radius);

                    const area = (x1 - x0 + 1) * (y1 - y0 + 1);

                    const sum =
                        integral[(y1 + 1) * (width + 1) + x1 + 1] -
                        integral[y0 * (width + 1) + x1 + 1] -
                        integral[(y1 + 1) * (width + 1) + x0] +
                        integral[y0 * (width + 1) + x0];

                    const mean = sum / area;
                    const value = gray[y * width + x] > mean - offset ? 255 : 0;

                    const p = (y * width + x) * 4;
                    binaryPixels[p] = value;
                    binaryPixels[p + 1] = value;
                    binaryPixels[p + 2] = value;
                    binaryPixels[p + 3] = 255;
                }
            }

            binaryCtx.putImageData(binaryData, 0, 0);

            // 3種類を同じOCR設定で認識
            const grayResult = await worker.recognize(grayCanvas);
            const contrastResult = await worker.recognize(contrastCanvas);
            const binaryResult = await worker.recognize(binaryCanvas);

            const grayText = grayResult.data.text.trim();
            const contrastText = contrastResult.data.text.trim();
            const binaryText = binaryResult.data.text.trim();

            console.log('【元グレースケール】', grayText);
            console.log('【コントラスト強調】', contrastText);
            console.log('【適応的二値化】', binaryText);

            console.log('========== OCR比較 ==========');
            console.log('【元グレースケール】\n', grayText);
            console.log('【コントラスト強調】\n', contrastText);
            console.log('【適応的二値化】\n', binaryText);
            console.log('============================');

            // 現時点では元画像を採用
            const leftText = grayText;


            


            if (leftText) {
                rowResults.push(leftText);
            }

            const rightResult = await worker.recognize(rightCanvas);
            const rightText = rightResult.data.text.trim();

            if (rightText) {
                priceResults.push(rightText);
            }
        }

        productOcrText = rowResults.join('\n');

        const priceOcrText = priceResults.join('\n');

        console.log('【左側・商品名OCR】');
        console.log(productOcrText);

        console.log('【右側・価格OCR】');
        console.log(priceOcrText);

        alert('商品名側:\n' + productOcrText + '\n\n価格側:\n' + priceOcrText);

        // OCR設定を元に戻す
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            preserve_interword_spaces: '1'
        });


        } else {
            console.log('商品欄の位置を特定できませんでした');
        }

        const lineInfo = result.data.lines.map(line =>
            `${line.confidence.toFixed(1)} : ${line.text}`
        ).join('\n');

        alert('行ごとの信頼度:\n' + lineInfo);

        console.table(result.data.lines.map(line => ({
            text: line.text,
            confidence: line.confidence
        })));

        const text = result.data.text;
        console.log('OCR結果:', text);
        alert('OCR結果:\n' + text);

        // レシート全体のOCR結果を行ごとに分割
        const lines = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        await worker.terminate();
        worker = null;

        const productLinesForExtract = productOcrText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        let amount = null;

        const linesForAmount = text
            .split('\n')
            .map(line => line.replace(/\s+/g, '').trim())
            .filter(line => line.length > 0);

        // 合計金額を示すキーワード
        const totalKeywords = [
            '合計', '総合計', 'お支払',
            'お買上合計', '税込合計', '今回合計'
        ];

        // 合計金額の行だけを探す
        for (const line of linesForAmount) {

            const normalized = line.replace(/[.,]/g, '');

            const hasTotalKeyword = totalKeywords.some(
                keyword => normalized.includes(keyword)
            );

            // T ¥1.413、+ ¥1.413 などの記号付き金額
            const hasTotalSymbol = /^[+＋TＴ~～][¥￥]?\d/.test(line);

            if (!hasTotalKeyword && !hasTotalSymbol) {
                continue;
            }

            // 預り金や税金などを除外
            if (/預|釣|お釣|消費税|内税|外税/.test(line)) {
                continue;
            }

            const match = line.match(/[¥￥]\s*([\d,.]+)/);

            if (!match) continue;

            const value = parseInt(
                match[1].replace(/[,.]/g, ''),
                10
            );

            if (value > 0) {
                amount = value;
                console.log('金額候補:', line, '抽出金額:', value);
                break;
            }
        }

        // 日付を抽出
        let date = null;

        for (const line of lines) {
            // 空白を除去して表記を統一
            let normalizedLine = line
                .replace(/\s+/g, '')
                .replace(/[%％]/g, '年')
                .replace(/[./]/g, '年');

            // YYYY年MM月DD日 形式
            const match = normalizedLine.match(
                /(20\d{2})年(\d{1,2})月(\d{1,2})日/
            );

            if (match) {
                const year = match[1];
                const month = match[2].padStart(2, '0');
                const day = match[3].padStart(2, '0');

                date = `${year}-${month}-${day}`;
                break;
            }
        }

        // フォームへ反映
        if (amount !== null) {
            document.getElementById('amount').value = amount;
        }

        if (date !== null) {
            document.getElementById('date').value = date;
        }

        // 店名を判定
        const allText = text.replace(/\s+/g, '');

        let storeName = '';

        if (/LAWSON|ローソン/.test(allText)) {
            storeName = 'ローソン';
        } else if (/FamilyMart|ファミリーマート/.test(allText)) {
            storeName = 'ファミリーマート';
        } else if (/セブンイレブン|SEVEN.?ELEVEN/i.test(allText)) {
            storeName = 'セブンイレブン';
        }

        let products = [];

        products = productLinesForExtract
            .map(line => {
                let cleaned = line;

                // 金額・数字・割引率などを除去
                cleaned = cleaned.replace(/[¥￥]\s*[\d,.]+/g, '');
                cleaned = cleaned.replace(/[0-9０-９]+([.,][0-9０-９]+)?/g, '');
                cleaned = cleaned.replace(/[％%]/g, '');

                // 個数・税区分などを除去
                cleaned = cleaned.replace(
                    /個|点|軽|税|割引|内税|外税|対象/g,
                    ''
                );

                return cleaned.replace(/\s+/g, '').trim();
            })
            .filter(line => {
                return /[ぁ-んァ-ヶ一-龠]/.test(line)
                    && line.length >= 3
                    && isFoodProductName(line);
            });

        // 内容欄に入力
        console.log('最終的な商品名候補:', products);

            

        // 内容欄に入力
        console.log('最終的な商品名候補:', products);
        const descriptionParts = [];

        if (storeName) {
            descriptionParts.push(storeName);
        }

        descriptionParts.push(...products);

        document.getElementById('description').value =
            descriptionParts.join('\n').slice(0, 200);

        // 支出・食費を初期値にする
        const kindSelect = document.getElementById('kind');
        kindSelect.value = 'expense';
        kindSelect.dispatchEvent(new Event('change'));

        document.getElementById('category').value = 'food';

        if (amount === null) {
            status.textContent = '読み取りましたが、合計金額を特定できませんでした。手入力してください。';
        } else {
            status.textContent = '読み取り完了。内容を確認してから保存してください。';
        }

    } catch (error) {
        console.error(error);
        status.textContent = '読み取りに失敗しました。画像を変えて再度お試しください。';

        if (worker) {
            await worker.terminate();
        }
    } finally {
        readButton.disabled = false;
    }
});
