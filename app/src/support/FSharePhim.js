const axios = require("axios")
const R = require("ramda")
const cheerio = require("cheerio")
const {tryOrDefault} = require("tryordefault")

module.exports = {
    search(titleToSearch) {
        return new Promise((resolve, reject) => {
            axios.get('https://fsharephim.com/?s='+titleToSearch)
            .then(res => {
                const $ = cheerio.load(res.data);
                $(".result-item .title a").each(function() {
                    if ($(this).text().toLowerCase() == titleToSearch.toLowerCase()) {
                        const detailUrl = $(this).attr('href');
                        resolve(detailUrl);
                        return false;
                    }
                });
                reject("Not found");
            })
            .catch(e => {
                reject(e);  
            });
            
        });
    },
    getByUrl(detailUrl, priorityFilter)
    {
        return new Promise((resolve, reject) => {
            axios.get(detailUrl)
            .then(res => {
                const $ = cheerio.load(res.data);
                let rawLinks = [];
                const trimProp = R.compose(
                    R.trim,
                    R.prop
                );
                const cleanUpLinkObject = (object) => {
                    R.forEach(
                        (key) => object[key] = trimProp(key, object),
                        R.keys(object)
                    )
                    return object;
                }
                $(".links_table .fix-table table tbody tr").each(function() {
                    const downloadLinkTag = $($(this).find("td").get(0)).find("a");
                    const serverType = $($(this).find("td").get(1)).text().trim();
                    const filename = $($(this).find("td").get(2)).text();
                    const quality = $($(this).find("td").get(3)).text();
                    if (serverType == "fshare.vn") {
                        const link = {
                            download_url: downloadLinkTag.attr("href"),
                            size: downloadLinkTag.find(".face-secondary").text(),
                            filename: filename,
                            quality: quality
                        };
                        rawLinks.push(cleanUpLinkObject(link));
                    }
                });
                const getTwoParts = R.split(" ");
                const convertTextToValue = x => {
                    switch (x) {
                        case "GB": return 1000;
                        case "MB": return 100;
                        case "KB": return 10;
                        default: return x;
                    }
                }
                const calculateValueFromSize = R.compose(
                    R.apply(R.multiply),
                    R.map(parseFloat),
                    R.map(x => convertTextToValue(x)),
                    getTwoParts,
                    R.trim
                    // R.prop("size")
                );
                const calculateSizeValues = R.map(x => {
                    x.size_value = calculateValueFromSize(x.size);
                    return x;
                });
                const sortBySizeAsc = R.sort((a,b) => { return a.size_value - b.size_value});
                processedAllLinks = calculateSizeValues(rawLinks);
                let links = [];
                if (priorityFilter) {
                    const filterThenSortBySize = R.compose(sortBySizeAsc, R.filter(priorityFilter));
                    links = filterThenSortBySize(processedAllLinks);
                }
                if (links.length == 0) {
                    links = sortBySizeAsc(processedAllLinks);
                }
                resolve(links);
            })
            .catch(e => {
                reject(e);  
            });
        });
    },
    getFshareUrl(downloadLink) {
        return new Promise((resolve, reject) => {
            axios.get(downloadLink)
            .then(res => {
                const $ = cheerio.load(res.data);
                resolve($(".boton.reloading a").attr("href"));
            })
            .catch(e => {
                reject(e);
            });
        });
    }
}