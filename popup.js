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

    async function waitUntilElement(selector, timeout) {
        let duration = 0;
        while (duration < timeout) {
            const ele = document.querySelector(selector);
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
        const inputEle = container.querySelector(
            "#textbox, ytcp-social-suggestion-input div[contenteditable='true'], ytcp-social-suggestion-input div, textarea"
        );
        if (!inputEle) return false;

        if (inputEle.tagName.toLowerCase() === "textarea") {
            inputEle.value = text || "";
        } else {
            inputEle.focus();
            inputEle.textContent = text || "";
        }

        inputEle.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        inputEle.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        return true;
    }

    async function addNewVersion(title, description, languageText) {
        console.log("addNewVersion", { title, description, languageText });
        const item = document;

        // Chờ modal dialog hiển thị ô Title (hỗ trợ cả layout mới có class và layout cũ có id)
        const titleSelector =
            "ytcp-social-suggestions-textbox.metadata-title, ytcp-social-suggestions-textbox#metadata-title, .metadata-title, #metadata-title, #translated-title";
        await waitUntilElementVisible(titleSelector, item, 10000);

        // 1. Nhập Title
        const titleContainer = item.querySelector(titleSelector);
        if (titleContainer) {
            setInputValue(titleContainer, title);
        } else {
            console.error("Không tìm thấy container Title!");
        }

        // 2. Nhập Description (nếu có)
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

        // 3. Xuất bản / Update
        await waitButtonPublishEnable(item, 10000);
        await checkAddTitleSuccess(languageText, 3000);
        // Khoảng nghỉ để YouTube đóng dialog trước khi sang ngôn ngữ tiếp theo
        await delay(500);
    }

    async function waitButtonPublishEnable(item, timeout) {
        let duration = 0;
        while (duration < timeout) {
            const btn = item.querySelector(
                "ytcp-button.ytgn-language-dialog-update, ytcp-button#publish-button"
            );
            if (btn) {
                const ariaDisabled = btn.getAttribute("aria-disabled");
                const hasDisabledAttr = btn.hasAttribute("disabled");
                const innerBtn = btn.querySelector("button");
                const innerDisabled = innerBtn
                    ? (innerBtn.disabled ||
                       innerBtn.getAttribute("aria-disabled") === "true" ||
                       innerBtn.classList.contains("ytcpButtonShapeImpl--disabled"))
                    : false;

                // Nút kích hoạt khi không bị disabled ở cả wrapper lẫn button con
                const isEnabled =
                    (ariaDisabled === "false" || (!hasDisabledAttr && ariaDisabled !== "true")) &&
                    !innerDisabled;

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
        console.warn("Hết thời gian chờ nút Update kích hoạt");
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
            if (!val[values.colLangID - 1]) {
                continue;
            }

            await waitUntilElement("ytcp-button#add-translations-button", 5000);
            const addTrans = document.querySelector(
                "ytcp-button#add-translations-button"
            );
            if (!addTrans) {
                console.warn("Không tìm thấy nút thêm bản dịch");
                continue;
            }
            addTrans.click();

            const langID = val[values.colLangID - 1];
            const elementLanguage = `tp-yt-paper-item[test-id="${langID}"]`;
            await waitUntilElement(elementLanguage, 3000);
            const chooseLanguage = document.querySelector(elementLanguage);

            if (
                !chooseLanguage ||
                chooseLanguage.getAttribute("aria-disabled") === "true"
            ) {
                console.warn("Ngôn ngữ không hợp lệ hoặc bị vô hiệu hóa:", langID);
                continue;
            }

            const languageText =
                chooseLanguage.querySelector("yt-formatted-string")?.textContent?.trim() || "";

            chooseLanguage.click();

            await addNewVersion(
                val[values.colTitle - 1],
                val[values.colDescription - 1],
                languageText
            );
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
