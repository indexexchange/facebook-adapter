/**
* File Information
* =============================================================================
* @overview  Facebook
* @version   1.0.0
* @author    Index Exchange
* @copyright Copyright (C) 2016 Index Exchange All Rights Reserved.
*
* The information contained within this document is confidential, copyrighted
* and or a trade secret. No part of this document may be reproduced or
* distributed in any form or by any means, in whole or in part, without the
* prior written permission of Index Exchange.
* -----------------------------------------------------------------------------
*/

window.headertag.partnerScopes.push(function() {
    'use strict';

    var PARTNER_ID = 'FB';

    var SUPPORTED_TARGETING_TYPES = {
        page: false,
        slot: true
    };

    var SUPPORTED_ANALYTICS = {
        time: true,
        demand: false
    };

    var SUPPORTED_OPTIONS = {
        prefetch: true,
        demandExpiry: -1
    };

    var prefetchState = {
        NEW: 1,
        IN_PROGRESS: 2,
        READY: 3,
        USED: 4
    };

    var roundingTypes = {
        FLOOR: 1,
        ROUND: 2,
        CEIL: 3
    };

    var targetKeys = {
        'om': 'ix_fb_om',
        'id': 'ix_fb_id'
    };

    var Utils = window.headertag.Utils;

    var Network = window.headertag.Network;

    function validateTargetingType(tt) {
        return typeof tt === 'string' && SUPPORTED_TARGETING_TYPES[tt];
    }

    function getAdUnits(config) {
        var adUnits = JSON.parse(JSON.stringify(config.xSlots));
        var mapping = config.mapping;

        for (var htSlotName in mapping) {
            if(!mapping.hasOwnProperty(htSlotName)) {
                continue;
            }
            var xSlotRefs = mapping[htSlotName];
            for(var i = 0; i < xSlotRefs.length; i++) {
                adUnits[xSlotRefs[i]].divId = htSlotName;
            }
        }

        return adUnits;
    } 

    function init(config, callback) {
        //? if (DEBUG) {
        var err = [];

        if (!config.hasOwnProperty('targetingType') || !validateTargetingType(config.targetingType)) {
            err.push('targetingType either not provided or invalid.');
        }
        if (!config.hasOwnProperty('xSlots') || !Utils.validateNonEmptyObject(config.xSlots)) {
            err.push('xSlots either not provided or invalid.');
        } else {
            var xSlots = config.xSlots;
            var placementIDs = {};
            for (var xSlot in xSlots) {
                if(!xSlots.hasOwnProperty(xSlot)) {
                    continue;
                }
                var adUnit = xSlots[xSlot];

                if (!adUnit.hasOwnProperty('placementId') || !Utils.validateNonEmptyString(adUnit.placementId)) {
                    err.push('placementId not provided or invalid for xSlot ' + xSlot);
                }
                if(placementIDs.hasOwnProperty(adUnit.placementId)) {
                    err.push('placementID ' + adUnit.placementId + ' is used for multiple xSlots');
                } else {
                    placementIDs[adUnit.placementId] = true;
                }

                if (!adUnit.hasOwnProperty('sizes') || !Utils.isArray(adUnit.sizes) || !adUnit.sizes.length) {
                    err.push('sizes not provided or invalid for xSlot ' + xSlot);
                } else {
                    if(adUnit.sizes.length !== 1) {
                        err.push('Multiple sizes for xSlot ' + xSlot);
                    }
                    for (var j = 0, lenj = adUnit.sizes.length; j < lenj; j++) {
                        var size = adUnit.sizes[j];
                        if (!Utils.isArray(size) || size.length !== 2 || !Utils.isInteger(size[0]) || !Utils.isInteger(size[1]) ) {
                            err.push('size not provided or invalid for xSlot' + xSlot);
                        }
                    }
                }
            }
        }
        if (config.hasOwnProperty('targetKeyOverride') && (!Utils.validateNonEmptyObject(config.targetKeyOverride))) {
            err.push('facebook.init: targetKeyOverride provided is invalid.');
        }
        if (config.hasOwnProperty('roundingBuckets')) {
            var bucketConfig = config.roundingBuckets;
            if (!bucketConfig.hasOwnProperty('type') || !Utils.isInteger(bucketConfig.type) || bucketConfig.type > 3 || bucketConfig.type < 0) {
                err.push('roundingBuckets type either not provided or invalid.');
            }
            if (!bucketConfig.hasOwnProperty('buckets') || !Utils.isArray(bucketConfig.buckets)) {
                err.push('buckets either not provided or invalid.');
            } else {
                for (var k = 0, len = bucketConfig.buckets.length; k < len; k++) {
                    var bucket = bucketConfig.buckets[k];
                    if (!Utils.isArray(bucket.range) || bucket.range.length !== 2) {
                        err.push('range not provided or invalid.');
                    } else {
                        if (!Utils.isInteger(bucket.range[0]) || !Utils.isInteger(bucket.range[1])) {
                            err.push('range not provided or invalid.');
                        }
                    }
                    if (!bucket.hasOwnProperty('granularity') || isNaN(bucket.granularity)) {
                        err.push('granularity not provided or invalid.');
                    }
                }
            }
        }

        if (!config.hasOwnProperty('mapping') || !Utils.validateNonEmptyObject(config.mapping)) {
            err.push('mapping either not provided or invalid.');
        } else {

            var seenXSlots = {};

            for (var htSlotName in config.mapping) {
                var mapping = config.mapping;
                var xSlots = mapping[htSlotName];
                if(!mapping.hasOwnProperty(htSlotName)) {
                    continue;
                }
                if(!Utils.isArray(xSlots) || !xSlots.length) {
                    err.push('xSlots either not provided or invalid for ' + htSlotName);
                }
                else {
                    var seenSizes = {};
                    for (var x = 0; x < xSlots.length; x++) {
                        if (config.xSlots.hasOwnProperty(xSlots[x])) {
                            var size = config.xSlots[xSlots[x]].sizes[0];
                            var sizeKey = size[0].toString() + 'x' + size[1].toString();
                            if (seenSizes.hasOwnProperty(sizeKey)) {
                                err.push('size ' + sizeKey + ' is mapped multiple times for ' + htSlotName);
                            } else {
                                seenSizes[sizeKey] = true;
                            }
                            if(seenXSlots.hasOwnProperty(xSlots[x])) {
                                err.push('xSlot ' + xSlots[x] + ' is mapped multiple times');
                            } else {
                                seenXSlots[xSlots[x]] = true;
                            }                        
                        } else {
                            err.push('invalid xSlot ' + xSlots[x] + ' in mapping for htSlot ' + htSlotName);
                        }
                    }
                }

            }
        }

        if (err.length) {
            callback(err);
            return;
        }
        //? }
        var facebookPartner = new Partner(config);
        window.headertag.renderFacebookAd = facebookPartner.fbRenderAd;

        callback(null, facebookPartner);  
    }

    function Partner(config) {
        var _this = this;
        var targetingType = config.targetingType;
        var supportedAnalytics = SUPPORTED_ANALYTICS;
        var supportedOptions = SUPPORTED_OPTIONS;
        var prefetch = {
            state: prefetchState.NEW,
            correlator: null,
            gCorrelator: null,
            slotIds: [],
            callbacks: []
        };
        var demandStore = {};
        var ads = {};
        var roundingBuckets = config.roundingBuckets ? config.roundingBuckets : {
            type: roundingTypes.FLOOR,
            buckets: [{
                range: [0, 20],
                granularity: 0.05
            }]
        };

        var adUnits = getAdUnits(config);

        var slotID = 1;

        var debugEnabled = config.debug;

        if (config.hasOwnProperty('targetKeyOverride')) {
            if (config.targetKeyOverride.hasOwnProperty('om') && Utils.validateNonEmptyString(config.targetKeyOverride.om)) {
                if (config.targetKeyOverride.om.length <= 20) {
                    targetKeys.om = config.targetKeyOverride.om;
                }
            }

            if (config.targetKeyOverride.hasOwnProperty('id') && Utils.validateNonEmptyString(config.targetKeyOverride.id)) {
                if (config.targetKeyOverride.id.length <= 20) {
                    targetKeys.id = config.targetKeyOverride.id;
                }
            }
        }

        this.getPartnerTargetingType = function getPartnerTargetingType() {
            return targetingType;
        };

        this.getSupportedAnalytics = function getSupportedAnalytics() {
            return supportedAnalytics;
        };

        this.getSupportedOptions = function getSupportedOptions() {
            return supportedOptions;
        };

        this.getPartnerDemandExpiry = function getPartnerDemandExpiry() {
            return supportedOptions.demandExpiry;
        };

        this.setPartnerTargetingType = function setPartnerTargetingType(tt) {
            if (!validateTargetingType(tt)) {
                return false;
            }
            targetingType = tt;
            return true;
        };

        this.fbRenderAd = function fbRenderAd(doc, targetMap, width, height) {
             if (doc && targetMap && width && height) {
                try {
                     var adId = targetMap[targetKeys.id]; // this 'ix_cdb_id' must be overridable
                     var size = width + 'x' + height;
                     var adObject = ads[adId][size];
                    if (adObject) {
                        var placementId = adObject.placementId;
                        var bidId = adObject.bidId;
                        doc.write('<html><body>' +
                            '<div style="display:none; position: relative;"><iframe style="display:none;"></iframe>' +
                                    '<scr'+'ipt type="text/javascript">' +
                                        'var data = {' +
                                            'placementid: "' + placementId + '",' +
                                            'format: "' + size + '",' +
                                            'bidid: "' + bidId + '",' +
                                            'testmode: false,' +
                                            'onAdLoaded: function(element) {' +
                                                'element.style.display = "block";' +
                                            '},' +
                                            'onAdError: function(errorCode, errorMessage) {}' +
                                        '};' +
                                        '(function(w, l, d, t) {' +
                                            'var a = t();' +
                                            'var b = d.currentScript || (function() {' +
                                                'var c = d.getElementsByTagName("script");' +
                                                'return c[c.length - 1];' +
                                            '})();' +
                                            'var e = b.parentElement;' +
                                            'e.dataset.placementid = data.placementid;' +
                                            'var f = function(v) {' +
                                            '    try {' +
                                            '        return v.document.referrer;' +
                                            '    } catch (e) {}' +
                                            '    return "";' +
                                            '};' +
                                            'var g = function(h) {' +
                                            '    var i = h.indexOf("/", h.indexOf("://") + 3);' +
                                            '    if (i === -1) {' +
                                            '        return h;' +
                                            '    }' +
                                            '    return h.substring(0, i);' +
                                            '};' +
                                            'var j = [l.href];' +
                                            'var k = false;' +
                                            'var m = false;' +
                                            'if (w !== w.parent) {' +
                                            '    var n;' +
                                            '    var o = w;' +
                                            '    while (o !== n) {' +
                                            '        var h;' +
                                            '        try {' +
                                            '            m = m || (o.$sf && o.$sf.ext);' +
                                            '            h = o.location.href;' +
                                            '        } catch (e) {' +
                                            '            k = true;' +
                                            '        }' +
                                            '        j.push(h || f(n));' +
                                            '        n = o;' +
                                            '        o = o.parent;' +
                                            '    }' +
                                            '}' +
                                            'var p = l.ancestorOrigins;' +
                                            'if (p) {' +
                                            '    if (p.length > 0) {' +
                                            '        data.domain = p[p.length - 1];' +
                                            '    } else {' +
                                            '        data.domain = g(j[j.length - 1]);' +
                                            '    }' +
                                            '}' +
                                            'data.url = j[j.length - 1];' +
                                            'data.channel = g(j[0]);' +
                                            'data.width = screen.width;' +
                                            'data.height = screen.height;' +
                                            'data.pixelratio = w.devicePixelRatio;' +
                                            'data.placementindex = w.ADNW && w.ADNW.Ads ? w.ADNW.Ads.length : 0;' +
                                            'data.crossdomain = k;' +
                                            'data.safeframe = !!m;' +
                                            'var q = {};' +
                                            'q.iframe = e.firstElementChild;' +
                                            'var r = "https://www.facebook.com/audiencenetwork/web/?sdk=5.3";' +
                                            'for (var s in data) {' +
                                            '    q[s] = data[s];' +
                                            '    if (typeof(data[s]) !== "function") {' +
                                            '        r += "&" + s + "=" + encodeURIComponent(data[s]);' +
                                            '    }' +
                                            '}' +
                                            'q.iframe.src = r;' +
                                            'q.tagJsInitTime = a;' +
                                            'q.rootElement = e;' +
                                            'q.events = [];' +
                                            'w.addEventListener("message", function(u) {' +
                                            '    if (u.source !== q.iframe.contentWindow) {' +
                                            '        return;' +
                                            '    }' +
                                            '    u.data.receivedTimestamp = t();' +
                                            '    if (this.sdkEventHandler) {' +
                                            '        this.sdkEventHandler(u.data);' +
                                            '    } else {' +
                                            '        this.events.push(u.data);' +
                                            '    }' +
                                            '}.bind(q), false);' +
                                            'q.tagJsIframeAppendedTime = t();' +
                                            'w.ADNW = w.ADNW || {};' +
                                            'w.ADNW.Ads = w.ADNW.Ads || [];' +
                                            'w.ADNW.Ads.push(q);' +
                                            'w.ADNW.init && w.ADNW.init(q);' +
                                        '})(window, location, document, Date.now || function() {' +
                                            'return +new Date;' +
                                        '});' +
                                    '</scr'+'ipt>' +
                                    '<scr'+'ipt type="text/javascript" src="https://connect.facebook.net/en_US/fbadnw.js" async></scr'+'ipt>' +
                                    '</div></body></html>');
                        doc.close();
                    } else {
                        //? if (DEBUG)
                        console.log('Error trying to write ad. Cannot find ad by given bidId : ' + bidId);
                    }
                } catch (e) {
                    //? if (DEBUG)
                    console.log('Error trying to write ad to the page.');
                }
            } else {
                //? if (DEBUG)
                console.log('Error trying to write ad to the page. Missing document or bidId.');
            }
        }; 

        function getPlacementId(divId) {
            var placementIDs = [];
            for (var xSlotRef in adUnits ) {
                if(!adUnits.hasOwnProperty(xSlotRef)) {
                    continue;
                }
                var adUnit = adUnits[xSlotRef];
                if (divId === adUnit.divId) {
                    placementIDs.push(adUnit.placementId);
                }
            }
            return placementIDs;
        }

        function parseSizesInput(sizeObj) {
            var parsedSizes = [];
            for (var i = 0; i < sizeObj.length; i++) {
                parsedSizes.push(sizeObj[i][0] + 'x' + sizeObj[i][1]);
            }
            return parsedSizes[0];
        }

        function getAdSize(placementId) {
            for (var xSlotRef in adUnits) {
                if(!adUnits.hasOwnProperty(xSlotRef)) {
                    continue;
                }
                var adUnit = adUnits[xSlotRef];
                if (placementId === adUnit.placementId) {
                    return parseSizesInput(adUnit.sizes);
                }
            }
            return '';
        }

        function getRequiredAdUnits(slots) {
            var requiredAdUnits = [];
            for (var i = 0, len = slots.length; i < len; i++) {
                var slotName = typeof slots[i] === 'object' ? slots[i].getSlotElementId() : slots[i];
                for (var xSlotRef in adUnits) {
                    if(!adUnits.hasOwnProperty(xSlotRef)) {
                        continue;
                    }
                    if( slotName === adUnits[xSlotRef].divId ) {
                        requiredAdUnits.push(adUnits[xSlotRef]);
                    }
                }
            }
            return requiredAdUnits;
        }

        function getRequestUrl(slots) {
            var requiredAdUnits = getRequiredAdUnits(slots);
            if (!requiredAdUnits.length) {
                return '';
            }
            var baseUrl = 'https://an.facebook.com/v2/placementbid.json';   
            var queryString = '?sdk=5.3.web&';
            for ( var adUnitNum = 0; adUnitNum < requiredAdUnits.length; adUnitNum++ ) {
                var adUnit = requiredAdUnits[adUnitNum];
                var placementId = encodeURIComponent(adUnit.placementId);
                var parsedSizes = encodeURIComponent(parseSizesInput(adUnit.sizes));
                queryString += 'placementids[]=' + placementId + '&adformats[]=' + parsedSizes + '&';
            }
            // remove the last ampersand 
            queryString = queryString.slice(0,-1);
            var referrer = encodeURIComponent(Utils.getPageUrl());
            queryString += '&pageurl=' + referrer;
            var debugmode = debugEnabled ? '&testmode=true' : '';
            var reqUrl = baseUrl + queryString + debugmode;
            return reqUrl;
        }

        function round(value) {
            var cpm = Number(value) / 100;
            var granularity = 1;
            for (var i = 0, len = roundingBuckets.buckets.length; i < len; i++) {
                var bucket = roundingBuckets.buckets[i];
                if (cpm >= bucket.range[0] && cpm < bucket.range[1]) {
                    granularity = bucket.granularity;
                    break;
                } else {
                    if (i === (len - 1)) {
                        cpm = bucket.range[1];
                        granularity = bucket.granularity;
                    }
                }
            }
            cpm = (cpm * 100) / (granularity * 100);
            if (roundingBuckets.type === roundingTypes.FLOOR) {
                cpm = Math.floor(cpm);
            } else if (roundingBuckets.type === roundingTypes.ROUND) {
                cpm = Math.round(cpm);
            } else if (roundingBuckets.type === roundingTypes.CEIL) {
                cpm = Math.ceil(cpm);
            }
            return (cpm * granularity).toFixed(2);
        }

        function sendDemandRequest(slots, callback) {
            var reqUrl = getRequestUrl(slots);
            var isXhrSupported = Network.isXhrSupported();
            if(!isXhrSupported || !reqUrl) {
                callback(null,{});
                return;
            }

            Network.ajax({
                url: reqUrl,
                method: 'GET',
                partnerId: 'FB',
                withCredentials: true,
                onSuccess: function(responseText){
                    callback(null, JSON.parse(responseText));

                },
                onFailure: function(){
                    callback('FB: No demand response');
                }
            });
        }

        this.prefetchDemand = function prefetchDemand(correlator, info, analyticsCallback) {
            prefetch.state = prefetchState.IN_PROGRESS;
            prefetch.correlator = correlator;
            prefetch.slotIds = info.divIds.slice();

            demandStore[correlator] = {
                slot: {}
            };

            sendDemandRequest(info.divIds, function (err, slotDemand) {
                var divIds = info.divIds;
                if (!err && slotDemand.hasOwnProperty('bids')) {
                    var fbDemands = slotDemand.bids;
                    for (var placement in fbDemands) { // remove all null objects
                        if(!fbDemands.hasOwnProperty(placement)) {
                            continue;
                        }
                        if ( fbDemands.hasOwnProperty(placement) ) { 
                            for (var k=fbDemands[placement].length-1; k>=0; k--) {
                                if ( !fbDemands[placement][k] ) {
                                    fbDemands[placement].splice(k,1);
                                }
                            }
                        }
                    }
                    for (var i = 0; i < divIds.length; i++) {
                        var divId = divIds[i];
                        var ix_fb_om = [];
                        var demandObj = {};
                        var noBid = true;
                        demandStore[correlator].slot[divId] = {};
                        demandStore[correlator].slot[divId].timestamp = Utils.now();
                        demandStore[correlator].slot[divId].demand = {};
                        var placementIDs = getPlacementId(divId);
                        var ix_fb_id;
                        for(var j = 0; j < placementIDs.length; j++) {
                            var placementID = placementIDs[j];
                            if ( fbDemands.hasOwnProperty(placementID) && fbDemands[placementID].length ) {
                                var adSize = getAdSize(placementID);
                                var demand = fbDemands[placementID][0];
                                var cpm = round(demand.bid_price_cents);
                                ix_fb_id = divId + '_' + slotID;
                                if (Number(cpm) !== 0) {
                                    ix_fb_om.push(adSize + '_' + cpm);
                                    ads[ix_fb_id] = ads[ix_fb_id] === undefined ? {} : ads[ix_fb_id];
                                    ads[ix_fb_id][adSize] = {
                                        bidId: demand.bid_id,
                                        placementId: placementID
                                    };
                                    noBid = false;
                                }
                            }                           
                        }
                        if(!noBid) {
                            demandObj[targetKeys.om] = ix_fb_om;
                            demandObj[targetKeys.id] = ix_fb_id;
                            slotID ++;
                        }
                        demandStore[correlator].slot[divId].demand = demandObj;
                    }
                    prefetch.state = prefetchState.READY;
                } else {
                    prefetch.state = prefetchState.READY;
                    for (var j = 0; j < divIds.length; j++ ) {
                        demandStore[correlator].slot[divIds[j]] = {};
                        demandStore[correlator].slot[divIds[j]].timestamp = Utils.now();
                        demandStore[correlator].slot[divIds[j]].demand = {};
                    }
                }

                analyticsCallback(correlator);

                for (var x = 0, lenx = prefetch.callbacks.length; x < lenx; x++) {
                    setTimeout(prefetch.callbacks[x], 0);
                }
            });
        };

        this.getDemand = function getDemand(correlator, slots, callback) {
            if (prefetch.state === prefetchState.IN_PROGRESS) {
                var currentDivIds = Utils.getDivIds(slots);
                var prefetchInProgress = false;
                for (var x = 0, lenx = currentDivIds.length; x < lenx; x++) {
                    var slotIdIndex = prefetch.slotIds.indexOf(currentDivIds[x]);
                    if (slotIdIndex !== -1) {
                        prefetch.slotIds.splice(slotIdIndex, 1);
                        prefetchInProgress = true;
                    }
                }
                if (prefetchInProgress) {
                    prefetch.callbacks.push(getDemand.bind(_this, correlator, slots, callback));
                    return;
                }
            }
            var demand = {
                slot: {}
            };
            if (prefetch.state === prefetchState.READY) {
                for (var i = slots.length - 1; i >= 0; i--) {
                    var divId = slots[i].getSlotElementId();
                    if (demandStore[prefetch.correlator].slot.hasOwnProperty(divId)) {
                        if (supportedOptions.demandExpiry < 0 || 
                            (Utils.now() - demandStore[prefetch.correlator].slot[divId].timestamp) <= supportedOptions.demandExpiry) {
                            demand.slot[divId] = demandStore[prefetch.correlator].slot[divId];
                            slots.splice(i, 1);
                        }
                        delete demandStore[prefetch.correlator].slot[divId];
                    }
                }
                if (!Utils.validateNonEmptyObject(demandStore[prefetch.correlator].slot)) {
                    prefetch.state = prefetchState.USED;
                }
                if (!slots.length) {
                    callback(null, demand);
                    return;
                }
            }
            sendDemandRequest(slots, function (err, slotDemand) {
                if (err) {
                    callback(err);
                    return;
                }
                if (slotDemand.hasOwnProperty('bids')) {
                    var fbDemands = slotDemand.bids;
                    for (var placement in fbDemands) { // remove all null objects
                        if(!fbDemands.hasOwnProperty(placement)) {
                            continue;
                        }
                        if ( fbDemands.hasOwnProperty(placement) ) { 
                            for (var k=fbDemands[placement].length-1; k>=0; k--) {
                                if ( !fbDemands[placement][k] ) {
                                    fbDemands[placement].splice(k,1);
                                }
                            }
                        }
                    }

                    for (var i = 0; i < slots.length; i++) {
                        var divId = slots[i].getSlotElementId();
                        var ix_fb_om = [];
                        var demandObj = {};
                        var noBid = true;
                        var placementIDs = getPlacementId(divId);
                        var ix_fb_id;
                        for(var j = 0; j < placementIDs.length; j++) {
                            var placementID = placementIDs[j];
                            if ( fbDemands.hasOwnProperty(placementID) && fbDemands[placementID].length ) {
                                var adSize = getAdSize(placementID);
                                var fbDemand = fbDemands[placementID][0];
                                var cpm = round(fbDemand.bid_price_cents);
                                ix_fb_id = divId + '_' + slotID;
                                if (Number(cpm) !== 0) {
                                    ix_fb_om.push(adSize + '_' + cpm);
                                    ads[ix_fb_id] = ads[ix_fb_id] === undefined ? {} : ads[ix_fb_id];
                                    ads[ix_fb_id][adSize] = {
                                        bidId: fbDemand.bid_id,
                                        placementId: placementID
                                    };
                                    noBid = false;
                                }
                            }                           
                        }
                        if(!noBid) {
                            demandObj[targetKeys.om] = ix_fb_om;
                            demandObj[targetKeys.id] = ix_fb_id;
                            slotID ++;
                        }
                        demand.slot[divId] = {
                            timestamp: Utils.now(),
                            demand: demandObj
                        };
                    }
                }
                callback(null, demand);
            });
        };
    }
    window.headertag.registerPartner(PARTNER_ID, init);
});
