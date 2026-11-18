document.addEventListener('DOMContentLoaded', function () {
    const startButton = document.getElementById('start-barcode');
    const stopButton = document.getElementById('stop-barcode');
    const video = document.getElementById('barcode-video');
    const status = document.getElementById('barcode-status');
    const overlay = document.getElementById('barcode-overlay');
    const overlayContext = overlay.getContext('2d');

    function drawBarcodeMarker(result = null) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;

        overlayContext.clearRect(
            0, 0, overlay.width, overlay.height
        );

        const centerX = overlay.width / 2;
        const centerY = overlay.height / 2;

        const boxWidth = overlay.width * 0.8;
        const boxHeight = overlay.height * 0.3;

        overlayContext.strokeStyle = result ? '#20d879' : '#ffffff';
        overlayContext.lineWidth = 4;

        overlayContext.strokeRect(
            centerX - boxWidth / 2,
            centerY - boxHeight / 2,
            boxWidth,
            boxHeight
        );
    }       
    let codeReader = null;
    let scannerControls = null;

    // カメラ起動
    startButton.addEventListener('click', async function () {
        try {
            status.textContent = 'カメラを起動しています...';

            codeReader = new ZXingBrowser.BrowserMultiFormatReader();
            document.getElementById('barcode-camera').style.display = 'block';
            video.addEventListener('loadedmetadata', function() {
                drawBarcodeMarker();
            }, {once: true });

            scannerControls = await codeReader.decodeFromVideoDevice(
                undefined,
                video,
                async function (result, error, controls) {
                    if (result) {
                        const barcode = result.getText();

                        // カメラを停止
                        controls.stop();
                        scannerControls = null;

                        startButton.disabled = false;
                        stopButton.disabled = true;

                        status.textContent = '商品情報を検索しています...';

                        try {
                            const response = await fetch(
                                    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=product_name,product_name_ja,product_name_languages&lc=ja`
                            );

                            const data = await response.json();

                            let productName = null;
                        
                        console.log('Open Food Facts:', data);

                        // ① Open Food Factsで検索
                        if (data.status === 1 && data.product) {
                            productName =
                                data.product.product_name_ja ||
                                data.product.product_name_languages?.ja ||
                                null;
                        }

                        // ② 見つからなければYahoo!ショッピングで検索
                        if (!productName) {
                            const yahooResponse = await fetch(
                                `/api/product/${encodeURIComponent(barcode)}`
                            );

                            const yahooData = await yahooResponse.json();
                            const yahooName = yahooData.product_name;

                            if (yahooName && /[ぁ-んァ-ヶ一-龠]/.test(yahooName)) {
                                productName = yahooName;
                            }
                        }

                        // ③ 商品名が見つかった場合
                        if (productName) {
                            const description =
                                document.getElementById('description');

                            if (!description) {
                                status.textContent = '内容欄が見つかりませんでした。';
                                return;
                            }

                            const currentText = description.value.trim();

                            const lines = currentText
                                ? currentText.split('\n').map(line => line.trim())
                                : [];

                            if (!lines.includes(productName)) {
                                description.value = currentText
                                    ? currentText + '\n' + productName
                                    : productName;
                            }

                            status.textContent = '商品を追加しました：' + productName;

                        } else {
                            status.textContent =
                                '商品が見つかりませんでした。手入力してください。';
                        }
                        } catch (error) {
                            console.error(error);

                            status.textContent =
                                '商品情報を取得できませんでした。';
                        }
                    }
                }
            );

            startButton.disabled = true;
            stopButton.disabled = false;

        } catch (error) {
            console.error(error);
            status.textContent =
                'カメラを起動できませんでした。カメラの使用を許可してください。';

            startButton.disabled = false;
            stopButton.disabled = true;
        }
    });

    // カメラ停止
    stopButton.addEventListener('click', function () {
        if (scannerControls) {
            scannerControls.stop();
            scannerControls = null;
        }

        overlayContext.clearRect(0, 0, overlay.width, overlay.height);
        document.getElementById('barcode-camera').style.display = 'none';
        status.textContent = 'カメラを停止しました。';

        startButton.disabled = false;
        stopButton.disabled = true;
    });
});