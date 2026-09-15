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
    async function waitUntilElement(selector, timeout) {
        // console.log("waitUntilElement");
        let duration = 0;
        const delay = (ms) => new Promise((res) => setTimeout(res, ms));
        while (duration < timeout) {
            var ele = document.querySelector(selector);
            if (ele) {
                break;
            }
            await delay(10);
            duration += 10;
        }
    }

    async function checkItemVisible(languageText, timeout) {
        const delay = (ms) => new Promise((res) => setTimeout(res, ms));
        let duration = 0;
        while (duration < timeout) {
            var list = document.querySelectorAll(
                "table ytgn-video-translation-row"
            );
            for (const item of list) {
                var text = item
                    .querySelector(
                        ".language-text.style-scope.ytgn-video-translation-row"
                    )
                    .textContent.trim();
                if (text == languageText) {
                    return item;
                }
            }
            await delay(10);
            duration += 10;
        }
        return null;
    }

    async function clickButtonAdd(item, timeout) {
        // console.log("waitButtonPublishEnable");
        const delay = (ms) => new Promise((res) => setTimeout(res, ms));
        let duration = 0;
        while (duration < timeout) {
            // var eles = item.querySelector('.metadata-hover-cell-container.remove-default-style.style-scope.ytgn-video-translation-cell-metadata ytgn-video-translation-hover-cell').querySelector('#hover-items-container ytcp-icon-button');
            var eles = item.querySelector("ytcp-icon-button#metadata-add");
            if (eles) {
                var btn = eles;
                btn.click();
                break;
            }
            await delay(10);
            duration += 10;
        }
    }

    async function addNewVersion(title, description, languageText) {
        console.log("addNewVersion", { title, description, languageText });
        // var item = await GetWrap(languageText, 10000);
        var item = document;
        await waitUntilElementVisible(
            "#translated-title > div > textarea",
            item,
            5000
        );
        var inputTitle = item.querySelector(
            "ytcp-social-suggestions-textbox#metadata-title ytcp-social-suggestion-input div"
        );
        inputTitle.textContent = title;
        inputTitle.dispatchEvent(new Event("input"));

        // //nhập description
        if (description) {
            // await waitUntilElementVisible(
            //     "#translated-description > div > textarea",
            //     item,
            //     5000
            // );
            var inputDescription = item.querySelector(
                "ytcp-social-suggestions-textbox#metadata-description ytcp-social-suggestion-input div"
            );
            inputDescription.textContent = description;
            inputDescription.dispatchEvent(new Event("input"));
        }
        // //xuất bản
        await waitButtonPublishEnable(item, 10000);
        await checkAddTitleSuccess(languageText, 3000);
    }

    async function waitButtonPublishEnable(item, timeout) {
        // console.log("waitButtonPublishEnable");
        const delay = (ms) => new Promise((res) => setTimeout(res, ms));
        let duration = 0;
        while (duration < timeout) {
            var eles = item
                .querySelector("ytcp-button.ytgn-language-dialog-update")
                .getAttribute("aria-disabled");
            if (eles == "false") {
                var btn = item.querySelector(
                    "ytcp-button.ytgn-language-dialog-update"
                );
                btn.click();
                console.log("publish button");
                break;
            }
            await delay(10);
            duration += 10;
        }
    }

    async function GetWrap(languageText, timeout) {
        const delay = (ms) => new Promise((res) => setTimeout(res, ms));
        let duration = 0;
        while (duration < timeout) {
            var list = document.querySelectorAll("#metadata-editor-wrapper");
            for (const item of list) {
                var text = item
                    .querySelector(
                        "#language-name-row .metadata-editor-translated .language-header"
                    )
                    .textContent.trim();
                console.log(text + "||||" + languageText);
                if (text == languageText) {
                    return item;
                }
            }
            await delay(10);
            duration += 10;
        }
        return null;
    }

    async function checkAddTitleSuccess(languageText, timeout) {
        const delay = (ms) => new Promise((res) => setTimeout(res, ms));
        let duration = 0;
        while (duration < timeout) {
            var text = document
                .querySelectorAll(
                    "ytgn-video-translation-row.style-scope.ytgn-video-translations-list div.language-text.style-scope.ytgn-video-translation-row"
                )[0]
                .textContent.trim();
            if (text == languageText) {
                console.log("check success");
                break;
            } else {
                // console.log("check failed");
            }
            await delay(10);
            duration += 10;
        }
    }

    async function waitUntilElementVisible(selector, item, timeout) {
        // console.log("waitUntilElementVisible");
        const delay = (ms) => new Promise((res) => setTimeout(res, ms));
        let duration = 0;
        while (duration < timeout) {
            var eles = item.querySelector(selector);
            if (eles) {
                break;
            }
            await delay(10);
            duration += 10;
        }
    }
    // ============================================================================================

    if (!Array.isArray(values?.data) || values?.data?.length === 0) {
        alert("Không có dữ liệu Google sheet");
        return false;
    }
    for (const val of values.data) {
        try {
            // console.log("val:", val);
            if (!val[values.colLangID - 1]) {
                continue;
            }

            await waitUntilElement("ytcp-button#add-translations-button", 5000);
            var addTrans = document.querySelector(
                "ytcp-button#add-translations-button"
            );
            addTrans.click();

            var langID = val[values.colLangID - 1];
            var elementLanguage = "tp-yt-paper-item[test-id=" + langID + "]";
            await waitUntilElement(elementLanguage, 3000);
            var chooseLanguage = document.querySelector(elementLanguage);
            // console.log(chooseLanguage)
            var languageText = document
                .querySelector(elementLanguage + " yt-formatted-string")
                .textContent.trim();
            // console.log(languageText)
            if (
                !chooseLanguage &&
                chooseLanguage.getAttribute("aria-disabled") == "true"
            ) {
                continue;
            }
            chooseLanguage.click();

            // var item = await checkItemVisible(languageText, 5000);
            // if (item != null) {
            // item.querySelector(
            //     ".metadata-hover-cell-container.remove-default-style.style-scope.ytgn-video-translation-cell-metadata ytgn-video-translation-hover-cell"
            // ).dispatchEvent(new Event("mouseover"));
            // await clickButtonAdd(item, 5000);
            await addNewVersion(
                val[values.colTitle - 1],
                val[values.colDescription - 1],
                languageText
            );
            // }
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
