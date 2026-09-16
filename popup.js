const BUTTON_ID = "add_title_btn";

let submitBtn = document.getElementById(BUTTON_ID);

submitBtn.addEventListener("click", async () => {
    const sheetName = document.querySelector("input#sheetNameTitle").value;
    const linkGGSheet = document.querySelector("input#linkGGSheetTitle").value;
    const columnTitle = document
        .querySelector("input#columnTitleTitle")
        .value.toUpperCase();
    const columnDescription = document
        .querySelector("input#columnDescriptionTitle")
        .value.toUpperCase();
    const columnLangID = document
        .querySelector("input#columnLangIDTitle")
        .value.toUpperCase();

    const data = {
        columnDescription,
        columnLangID,
        columnTitle,
        linkGGSheet,
        sheetName,
    };

    // Validate form
    const isSuccess = validateForm(data);
    if (!isSuccess) {
        return false;
    }
    // =======================================

    const tabId = await getCurrentTabId();
    const values = await getData(data);

    chrome.scripting.executeScript({
        target: { tabId },
        function: onSubmit,
        args: [values],
    });
});

async function onSubmit(values) {
    // ============================================================================================
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    async function waitUntilElement(selector, timeout, root = document) {
        let duration = 0;
        while (duration < timeout) {
            const ele = root.querySelector(selector);
            if (ele) {
                return ele;
            }
            await delay(50);
            duration += 50;
        }
        return null;
    }

    async function waitUntilElementVisible(selector, item, timeout) {
        let duration = 0;
        while (duration < timeout) {
            const ele = item.querySelector(selector);
            if (ele) {
                return ele;
            }
            await delay(50);
            duration += 50;
        }
        return null;
    }

    function setInputValue(container, text) {
        if (!container) return false;
        let inputEle = container;
        const tagName = inputEle.tagName ? inputEle.tagName.toLowerCase() : "";
        if (tagName !== "textarea" && !inputEle.getAttribute?.("contenteditable")) {
            inputEle = container.querySelector(
                "#textbox, ytcp-social-suggestion-input div[contenteditable='true'], ytcp-social-suggestion-input div, textarea"
            );
        }
        if (!inputEle) return false;

        if (inputEle.tagName && inputEle.tagName.toLowerCase() === "textarea") {
            inputEle.value = text || "";
        } else {
            inputEle.focus();
            inputEle.textContent = text || "";
        }

        inputEle.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        inputEle.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        return true;
    }

    // Kiểm tra xem Modal Dialog của giao diện mới có ĐANG THỰC SỰ HIỂN THỊ trên màn hình hay không
    function isNewDialogActuallyOpen() {
        const titleBox = document.querySelector(
            "ytcp-social-suggestions-textbox.metadata-title, ytcp-social-suggestions-textbox#metadata-title, .ytgn-language-dialog ytcp-social-suggestions-textbox"
        );
        if (titleBox) {
            const rect = titleBox.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const style = window.getComputedStyle(titleBox);
                if (style.display !== "none" && style.visibility !== "hidden") {
                    return true;
                }
            }
        }
        return false;
    }

    // Kiểm tra xem một dòng trong bảng có phải là ngôn ngữ mặc định của video hay không
    // Đặc điểm ngôn ngữ mặc định: CHỈ có nút sửa (edit/pencil), KHÔNG CÓ nút xóa hay menu tùy chọn (options)
    function isDefaultVideoLanguageRow(rowItem) {
        if (!rowItem) return false;

        // 1. Kiểm tra văn bản ngôn ngữ có chứa chỉ dấu ngôn ngữ video mặc định
        // Ví dụ: "English (video language)", "Tiếng Việt (ngôn ngữ của video)"
        const langText = (
            rowItem.querySelector(".language-text, .tablecell-language")?.textContent || ""
        ).trim().toLowerCase();

        if (
            langText.includes("video language") ||
            langText.includes("ngôn ngữ của video") ||
            langText.includes("ngôn ngữ video") ||
            /\([^)]*video[^)]*\)/i.test(langText)
        ) {
            return true;
        }

        // 2. Kiểm tra xem dòng có nút Xóa hoặc Menu Tùy chọn (Options/Delete) hay không
        // Các hàng bản dịch thông thường luôn có menu 3 chấm (Options) hoặc nút Xóa (Delete)
        // Hàng ngôn ngữ mặc định CHỈ có nút sửa (edit/pencil), HOÀN TOÀN KHÔNG CÓ nút/menu Xóa
        const hasDeleteOrOptions = rowItem.querySelector(
            "ytcp-icon-button#delete, ytcp-icon-button#options, ytcp-icon-button[aria-label*='Delete' i], ytcp-icon-button[aria-label*='Xóa' i], ytcp-icon-button[aria-label*='Option' i], ytcp-icon-button[aria-label*='Tùy chọn' i], #delete-button"
        );

        const hasEditBtn = rowItem.querySelector(
            "ytcp-icon-button#metadata-edit, ytcp-icon-button[aria-label*='Edit' i], ytcp-icon-button[aria-label*='Chỉnh sửa' i], ytcp-icon-button#captions-edit"
        );

        const hasAddBtn = rowItem.querySelector(
            "ytcp-icon-button#metadata-add, ytcp-icon-button#captions-add, [aria-label*='Add' i], [aria-label*='Thêm' i]"
        );

        // Nếu dòng chỉ có nút sửa, không có bất kỳ nút/menu xóa hay options nào và không có nút thêm -> Ngôn ngữ mặc định
        if (hasEditBtn && !hasDeleteOrOptions && !hasAddBtn) {
            return true;
        }

        return false;
    }

    // --- Logic hỗ trợ Giao diện Cũ (Table Row) ---
    async function checkItemVisible(languageText, timeout) {
        let duration = 0;
        while (duration < timeout) {
            const list = document.querySelectorAll(
                "#table-list ytgn-video-translation-row, ytgn-video-translation-row, tr.ytgn-video-translation-row, tr#row-container"
            );
            for (const item of list) {
                // Bỏ qua nếu đây là dòng ngôn ngữ mặc định của video (chỉ có sửa, không có xóa)
                if (isDefaultVideoLanguageRow(item)) {
                    continue;
                }

                const text = item
                    .querySelector(
                        ".language-text.style-scope.ytgn-video-translation-row, .language-text"
                    )
                    ?.textContent?.trim();
                if (
                    text === languageText ||
                    (text && languageText && (text.toLowerCase() === languageText.toLowerCase() || text.includes(languageText) || languageText.includes(text)))
                ) {
                    return item;
                }
            }
            await delay(50);
            duration += 50;
        }
        return null;
    }

    function triggerHoverMetadata(rowItem) {
        if (!rowItem) return null;
        // Chỉ nhắm vào ô Metadata (Title & Description), TUYỆT ĐỐI không hover sang ô Captions (Subtitles)
        const metadataCell =
            rowItem.querySelector("td.tablecell-metadata") ||
            rowItem.querySelector("ytgn-video-translation-cell-metadata") ||
            rowItem.querySelector(".tablecell-metadata") ||
            rowItem;

        const targets = [
            metadataCell.querySelector(".metadata-hover-cell-container ytgn-video-translation-hover-cell"),
            metadataCell.querySelector(".metadata-hover-cell-container"),
            metadataCell.querySelector("ytgn-video-translation-hover-cell"),
            metadataCell.querySelector("#cell-container"),
            metadataCell,
        ];
        for (const target of targets) {
            if (target) {
                target.dispatchEvent(new Event("mouseover", { bubbles: true }));
                target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
                target.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true }));
            }
        }
        return metadataCell;
    }

    const triggerHover = triggerHoverMetadata;

    async function clickButtonAdd(item, timeout) {
        let duration = 0;
        while (duration < timeout) {
            const metadataCell = triggerHoverMetadata(item) || item;

            // CHỈ tìm nút mở Title & Description (#metadata-add / #metadata-edit), TUYỆT ĐỐI KHÔNG click #captions-add
            const btn =
                metadataCell.querySelector("ytcp-icon-button#metadata-add") ||
                metadataCell.querySelector("ytcp-icon-button#metadata-edit") ||
                item.querySelector("td.tablecell-metadata ytcp-icon-button#metadata-add, ytgn-video-translation-cell-metadata ytcp-icon-button#metadata-add") ||
                item.querySelector("ytcp-icon-button#metadata-add") ||
                metadataCell.querySelector(".hover-items-container ytcp-icon-button") ||
                metadataCell.querySelector("ytcp-icon-button");

            // Bảo vệ nghiêm ngặt: không click nếu là nút phụ đề (captions)
            if (
                btn &&
                btn.id !== "captions-add" &&
                !btn.closest("td.tablecell-captions, ytgn-video-translation-cell-captions")
            ) {
                const inner = btn.querySelector("button") || btn;
                inner.click();
                btn.click();
                console.log("clickButtonAdd: đã click nút mở modal/editor Title & Description (#metadata-add)");
                return true;
            }
            await delay(50);
            duration += 50;
        }
        console.warn("clickButtonAdd: hết thời gian chờ nút metadata-add");
        return false;
    }

    async function GetWrap(languageText, timeout) {
        let duration = 0;
        while (duration < timeout) {
            const list = document.querySelectorAll("#metadata-editor-wrapper");
            if (list.length === 1) {
                return list[0];
            }
            for (const item of list) {
                const text = item
                    .querySelector(
                        "#language-name-row .metadata-editor-translated .language-header"
                    )
                    ?.textContent?.trim();
                if (
                    text &&
                    (text === languageText || text.includes(languageText) || languageText.includes(text))
                ) {
                    return item;
                }
            }
            await delay(50);
            duration += 50;
        }
        return document.querySelector("#metadata-editor-wrapper") || document;
    }

    async function addNewVersionClassic(title, description, languageText) {
        console.log("addNewVersionClassic (Giao diện cũ)", { title, description, languageText });
        const wrap = await GetWrap(languageText, 10000);
        const scope = wrap || document;

        const titleSelector =
            "#translated-title textarea, #translated-title > div > textarea, #translated-title, .metadata-title, #metadata-title";
        await waitUntilElementVisible(titleSelector, scope, 8000);

        const titleContainer =
            scope.querySelector("#translated-title textarea, #translated-title > div > textarea") ||
            scope.querySelector("#translated-title") ||
            scope.querySelector(titleSelector);

        if (titleContainer) {
            setInputValue(titleContainer, title);
        } else {
            console.error("Không tìm thấy ô Title giao diện cũ!");
        }

        if (description) {
            const descSelector =
                "#translated-description textarea, #translated-description > div > textarea, #translated-description, .metadata-description, #metadata-description";
            await waitUntilElementVisible(descSelector, scope, 5000);
            const descContainer =
                scope.querySelector("#translated-description textarea, #translated-description > div > textarea") ||
                scope.querySelector("#translated-description") ||
                scope.querySelector(descSelector);

            if (descContainer) {
                setInputValue(descContainer, description);
            } else {
                console.error("Không tìm thấy ô Description giao diện cũ!");
            }
        }

        await waitButtonPublishEnable(scope, 10000);
        await checkAddTitleSuccess(languageText, 3000);
        await delay(500);
    }

    // --- Logic hỗ trợ Giao diện Mới (Modal Dialog) ---
    async function addNewVersionDialog(title, description, languageText) {
        console.log("addNewVersionDialog (Giao diện mới)", { title, description, languageText });
        const item = document;

        const titleSelector =
            "ytcp-social-suggestions-textbox.metadata-title, ytcp-social-suggestions-textbox#metadata-title, .metadata-title, #metadata-title, #translated-title";
        await waitUntilElementVisible(titleSelector, item, 10000);

        const titleContainer = item.querySelector(titleSelector);
        if (titleContainer) {
            setInputValue(titleContainer, title);
        } else {
            console.error("Không tìm thấy container Title!");
        }

        if (description) {
            const descSelector =
                "ytcp-social-suggestions-textbox.metadata-description, ytcp-social-suggestions-textbox#metadata-description, .metadata-description, #metadata-description, #translated-description";
            const descContainer = item.querySelector(descSelector);
            if (descContainer) {
                setInputValue(descContainer, description);
            } else {
                console.error("Không tìm thấy container Description!");
            }
        }

        await waitButtonPublishEnable(item, 10000);
        await checkAddTitleSuccess(languageText, 3000);
        await delay(500);
    }

    // --- Hàm chờ nút Publish / Update chung cho cả 2 giao diện ---
    async function waitButtonPublishEnable(item, timeout) {
        let duration = 0;
        const scope = item || document;
        while (duration < timeout) {
            const selector = "ytcp-button.ytgn-language-dialog-update, ytcp-button#publish-button";
            const btn = scope.querySelector(selector) || document.querySelector(selector);
            if (btn) {
                const ariaDisabled = btn.getAttribute("aria-disabled");
                const hasDisabledAttr = btn.hasAttribute("disabled");
                const innerBtn = btn.querySelector("button");
                const innerDisabled = innerBtn
                    ? (innerBtn.disabled ||
                       innerBtn.getAttribute("aria-disabled") === "true" ||
                       innerBtn.classList.contains("ytcpButtonShapeImpl--disabled"))
                    : false;

                // Nút kích hoạt khi không bị disabled
                const isEnabled =
                    ariaDisabled === "false" ||
                    (!hasDisabledAttr && ariaDisabled !== "true" && !innerDisabled);

                if (isEnabled) {
                    if (innerBtn) {
                        innerBtn.click();
                    }
                    btn.click();
                    console.log("publish/update button clicked");
                    return true;
                }
            }
            await delay(100);
            duration += 100;
        }
        console.warn("Hết thời gian chờ nút Publish/Update kích hoạt");
        return false;
    }

    async function checkAddTitleSuccess(languageText, timeout) {
        let duration = 0;
        while (duration < timeout) {
            const rows = document.querySelectorAll(
                "ytgn-video-translation-row.style-scope.ytgn-video-translations-list div.language-text.style-scope.ytgn-video-translation-row, table ytgn-video-translation-row .language-text"
            );
            const text = rows[0]?.textContent?.trim();
            if (text === languageText) {
                console.log("check success:", languageText);
                break;
            }
            await delay(100);
            duration += 100;
        }
    }
    // ============================================================================================

    if (!Array.isArray(values?.data) || values?.data?.length === 0) {
        alert("Không có dữ liệu Google sheet");
        return false;
    }

    for (const val of values.data) {
        try {
            const langID = val[values.colLangID - 1];
            if (!langID) {
                continue;
            }

            const title = val[values.colTitle - 1] || "";
            const description = val[values.colDescription - 1] || "";

            // 1. Mở menu danh sách ngôn ngữ
            await waitUntilElement("ytcp-button#add-translations-button", 5000);
            const addTrans = document.querySelector(
                "ytcp-button#add-translations-button"
            );
            if (!addTrans) {
                console.warn("Không tìm thấy nút thêm bản dịch");
                continue;
            }

            const innerAddBtn = addTrans.querySelector("button");
            if (innerAddBtn) innerAddBtn.click();
            addTrans.click();

            // 2. Tìm phần tử ngôn ngữ trong dropdown
            const elementLanguage = `tp-yt-paper-item[test-id="${langID}"]`;
            await waitUntilElement(elementLanguage, 3000);
            const chooseLanguage = document.querySelector(elementLanguage);

            if (!chooseLanguage) {
                console.warn("Không tìm thấy ngôn ngữ trong dropdown:", langID);
                document.body.click();
                continue;
            }

            const languageText =
                chooseLanguage.querySelector("yt-formatted-string")?.textContent?.trim() || "";
            const isItemDisabled = chooseLanguage.getAttribute("aria-disabled") === "true";

            // 3. Nếu ngôn ngữ ĐÃ CÓ SẴN TRONG BẢNG (bị disabled trong menu)
            if (isItemDisabled) {
                document.body.click(); // Đóng dropdown menu
                await delay(300);

                // Kiểm tra nếu ngôn ngữ này là ngôn ngữ mặc định của video (chỉ có sửa, không có xóa) -> Bỏ qua
                const allRows = document.querySelectorAll(
                    "#table-list ytgn-video-translation-row, ytgn-video-translation-row, tr.ytgn-video-translation-row, tr#row-container"
                );
                let isDefaultRow = false;
                for (const r of allRows) {
                    const rText = (r.querySelector(".language-text, .tablecell-language")?.textContent || "").trim().toLowerCase();
                    const targetText = languageText.trim().toLowerCase();
                    if (
                        (rText === targetText || rText.includes(targetText) || targetText.includes(rText)) &&
                        isDefaultVideoLanguageRow(r)
                    ) {
                        isDefaultRow = true;
                        break;
                    }
                }

                if (isDefaultRow) {
                    console.log(
                        `Bỏ qua ngôn ngữ ${languageText} [${langID}] vì là ngôn ngữ mặc định của video (chỉ có nút sửa, không có nút xóa).`
                    );
                    continue;
                }

                console.log(`Ngôn ngữ ${languageText} [${langID}] đã có trong bảng bản dịch, tiến hành mở modal chỉnh sửa`);
                const existingRow = await checkItemVisible(languageText, 3000);
                if (existingRow) {
                    triggerHover(existingRow);
                    const clicked = await clickButtonAdd(existingRow, 5000);
                    if (clicked) {
                        await addNewVersionClassic(title, description, languageText);
                    }
                } else {
                    console.warn("Không tìm thấy hàng tương ứng trong bảng:", languageText);
                }
                continue;
            }

            // 4. Nếu ngôn ngữ CHƯA CÓ, click để thêm
            chooseLanguage.click();
            chooseLanguage.dispatchEvent(
                new MouseEvent("click", { bubbles: true, cancelable: true })
            );

            // 5. Nhận diện layout: Chờ xem Modal Dialog của giao diện mới có hiển thị thực sự trên màn hình không
            let isNewLayout = false;
            let waitTime = 0;
            while (waitTime < 2000) {
                if (isNewDialogActuallyOpen()) {
                    isNewLayout = true;
                    break;
                }
                await delay(100);
                waitTime += 100;
            }

            if (isNewLayout) {
                console.log("Phát hiện giao diện mới (Modal Dialog hiển thị)");
                await addNewVersionDialog(title, description, languageText);
            } else {
                console.log("Xử lý giao diện cũ: tìm hàng trong bảng để mở modal/editor:", languageText);
                const rowItem = await checkItemVisible(languageText, 6000);
                if (rowItem) {
                    triggerHover(rowItem);
                    const clicked = await clickButtonAdd(rowItem, 5000);
                    if (clicked) {
                        await addNewVersionClassic(title, description, languageText);
                    } else {
                        console.warn("Không click được nút Thêm bản dịch trên dòng:", languageText);
                    }
                } else {
                    console.warn("Không tìm thấy dòng ngôn ngữ trong bảng sau khi click:", languageText);
                }
            }
        } catch (error) {
            console.log("error", error);
        }
    }

    alert("Thêm subtitle Youtube thành công.");
}

async function getCurrentTabId() {
    let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
    });
    return tab.id;
}

function validateForm(data) {
    const {
        columnDescription,
        columnLangID,
        columnTitle,
        linkGGSheet,
        sheetName,
    } = data;

    if (!sheetName) {
        alert("Bạn chưa nhập tên trang tính.");
        return false;
    }
    if (!linkGGSheet) {
        alert("Bạn chưa nhập link Google sheet");
        return false;
    }
    if (!columnLangID) {
        alert("Bạn chưa nhập cột mã ngôn ngữ");
        return false;
    }
    if (!columnTitle) {
        alert("Bạn chưa nhập cột tiêu đề.");
        return false;
    }
    if (!columnDescription) {
        let isExecuted = confirm(
            "Bạn chưa nhập cột mô tả, bạn có muốn tiếp tục không"
        );
        if (isExecuted) {
        } else {
            return false;
        }
    }

    return true;
}

async function getData(val) {
    const data = await getValuesFromGoogleSheet(val);
    const colTitle = indexColumnSheet(val.columnTitle);
    const colDescription = indexColumnSheet(val.columnDescription);
    const colLangID = indexColumnSheet(val.columnLangID);

    const values = {
        colTitle,
        colDescription,
        colLangID,
        data,
    };

    return values;
}

async function getValuesFromGoogleSheet(inputDetail) {
    // AIzaSyDH05uX_SK00t_xmwGLidqCDLv1HnuRCzA
    // console.log("getValuesFromGoogleSheet");
    try {
        var id = inputDetail.linkGGSheet.split("/");
        let arrayValue = {};

        const url =
            "https://sheets.googleapis.com/v4/spreadsheets/" +
            id[5] +
            "/values/" +
            inputDetail.sheetName;
        let accessToken = await getAccessToken();
        let bearer = "Bearer " + accessToken;
        await fetch(url, {
            method: "GET",
            // withCredentials: true,
            // credentials: "include",
            headers: {
                Authorization: bearer,
                "Content-Type": "application/json",
            },
        })
            .then((response) => response.text())
            .then((text) => {
                arrayValue = JSON.parse(text).values;
            });
        return arrayValue;
    } catch (error) {
        alert("Lấy dữ liệu trên google sheet không thành công:" + error);
    }
}

async function getAccessToken() {
    let data = {
        client_id:
            "775517594497-tg464m0g6p9c6p93er5mr6q5fcmfma3s.apps.googleusercontent.com",
        client_secret: "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",
        refresh_token:
            "1//0eQcCt0pRhzDjCgYIARAAGA4SNwF-L9IrEXYFUoHgIJbhdoaPOutbHd4Dml1ALInoo1Ml-fsP1F6GX0WB0oz0WCfIr1rJdHqEVLs",
        grant_type: "refresh_token",
    };
    var formBody = [];
    for (var property in data) {
        var encodedKey = encodeURIComponent(property);
        var encodedValue = encodeURIComponent(data[property]);
        formBody.push(encodedKey + "=" + encodedValue);
    }
    formBody = formBody.join("&");

    var response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody,
    });

    if (!response.ok) {
        alert("Lấy token không thành công");
        throw new Error("Lỗi khi refresh token");
    }
    var body = await response.json();
    return body.access_token;
}

function indexColumnSheet(val) {
    // console.log("indexColumnSheet");
    if (val) {
        var base = "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
            i,
            j,
            result = 0;

        for (i = 0, j = val.length - 1; i < val.length; i += 1, j -= 1) {
            result += Math.pow(base.length, j) * (base.indexOf(val[i]) + 1);
        }
        return result;
    } else {
        alert("Không có dữ liệu column sheet!");
    }
}
