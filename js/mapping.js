// =============================================================================
// mapping.js — Static reference data derived from mapping.xlsx (Ref sheet)
// Columns: Portfolio (Portfolio), Offer, Use Case, Type, Guide
// =============================================================================

var CPI_MAPPING = [
  { portfolio: "Networking",                offer: "Catalyst Center",               useCase: "Campus Network Automation",                              type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCVDV84mh3TJQ8QDPD3b8W2DTcW3" },
  { portfolio: "Networking",                offer: "Catalyst Center",               useCase: "Campus Network Observability and Insights",               type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DC9H9RVF89BMXGF2dXb2BFQFM7T8" },
  { portfolio: "Networking",                offer: "Catalyst Center",               useCase: "Campus Network Programmability and Integrations",         type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DCc8W63BVHF4W87WV3Pf8PVcFq8P" },
  { portfolio: "Networking",                offer: "Catalyst Center",               useCase: "Campus Network Segmentation",                            type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DCmXHjbd8qqG284Jc2h7fhqCjXhG" },
  { portfolio: "Networking",                offer: "Catalyst Center",               useCase: "Campus Network Visibility",                              type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DC7RTb387qGWh8qWmHhfR494d48j" },
  { portfolio: "Networking",                offer: "Meraki",                        useCase: "Cloud Monitoring for Catalyst",                          type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCc6fbbGg4Dhh872BFDXbjP9T3c8" },
  { portfolio: "Networking",                offer: "Catalyst Center",               useCase: "Internet and Cloud Visibility",                          type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCqqQQh9MFjC7GhB4f27p3Q29Mp8" },
  { portfolio: "Networking",                offer: "Catalyst Center",               useCase: "Location Based Intelligence",                            type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DCXqmHdjGfcB38CCfXbBcTWMXTQV" },
  { portfolio: "Networking",                offer: "Meraki",                        useCase: "Foundational Networking and Security for Meraki",        type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCq946RP494fQGhMMj8Tj7DFhMFB" },
  { portfolio: "Networking",                offer: "Meraki",                        useCase: "Programmability and Integrations for Meraki",            type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DCJFWjc8VhHmdGc27fQgm7VG8dJ8" },
  { portfolio: "Networking",                offer: "SD WAN",                        useCase: "Multicloud Connectivity",                                type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DC6b33dB8DFQ7GFD884m9JCFVHRd" },
  { portfolio: "Networking",                offer: "SD WAN",                        useCase: "SD-Routing",                                             type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCXpXdRBQW63287WQf7pVJm4fqFd" },
  { portfolio: "Networking",                offer: "SD WAN",                        useCase: "Secure Automated WAN",                                   type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DCT9mHbWqbjVq89JRmXWmcRjdF6d" },
  { portfolio: "Security",                  offer: "Cisco Secure Network Analytics", useCase: "Network Security Analytics",                            type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DC3h72hWC28BDG2MFXj9FQWdFgd8" },
  { portfolio: "Security",                  offer: "Duo",                           useCase: "Secure Application Access With Phishing-Resistant MFA", type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DChWJPjDhBHCG8cQQT4dJhGDGqXB" },
  { portfolio: "Security",                  offer: "Cisco Umbrella",                useCase: "DNS Security",                                           type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCTmhf2TBqq4WG7Xh7TVbHDTFfF3" },
  { portfolio: "Security",                  offer: "Cisco Umbrella",                useCase: "Public Cloud Security Policy and Access",                type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DCJThRm6W4gMBGHWGRP9bRXh8Hjd" },
  { portfolio: "Security",                  offer: "Cisco Secure Firewall",         useCase: "Data Center Firewall Operations",                        type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DCHFpmXWT92HTGQCqH6Mfm3gCPj3" },
  { portfolio: "Security",                  offer: "Cisco Secure Firewall",         useCase: "Internet Edge Protection",                               type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DCCjTFMPQQWGG8WF2GjCgHCRpffB" },
  { portfolio: "Security",                  offer: "Identity Services Engine",      useCase: "Network Access Control",                                type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCjjXWbm7hpJPGcT9XpV7MpW47cj" },
  { portfolio: "Security",                  offer: "Cisco Secure Access",            useCase: "Secure Internet Access",                                type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DChPgMTQ37dhmGTMQq6f7Fm2bHVG" },
  { portfolio: "Security",                  offer: "Cisco Secure Access",            useCase: "Secure Private Access",                                 type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCcCB2Jfp2qGgGhRHDB4cD9JXRbP" },
  { portfolio: "Security",                  offer: "Cisco Secure Access",            useCase: "DNS Defense",                                           type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCb4hMW72p6J7G4RJ9h8GjGVq9Mj" },
  { portfolio: "Cloud + AI Infrastructure", offer: "Cisco Intersight",              useCase: "Simplified Operations",                                  type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DC4Pd2GRgGFRg8cFdMQWMqcMFC7d" },
  { portfolio: "Cloud + AI Infrastructure", offer: "Data Center Networking",        useCase: "Data Center Network Operations",                         type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DCMTJ82j6CjgbG9RT6pMjpgDpFXG" },
  { portfolio: "Cloud + AI Infrastructure", offer: "Data Center Networking",        useCase: "Distributed Networking",                                 type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DCbB2Mm8GbV3G8qJJgmb4qqQJJTP" },
  { portfolio: "Cloud + AI Infrastructure", offer: "Data Center Networking",        useCase: "Distributed Networking with NDFC (DCNM)",                type: "Advanced", guide: "https://salesresources.cisco.com/Link/Content/DC7Qh9M2bJHDM8f2fjDqhPjVX6Pj" },
  { portfolio: "Cloud + AI Infrastructure", offer: "Data Center Networking",        useCase: "Fabric Provisioning and Operations with NDFC (DCNM)",    type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCH4dRd8bC7q38WDVGPCqjTdgf2j" },
  { portfolio: "Cloud + AI Infrastructure", offer: "Data Center Networking",        useCase: "Network Provisioning and Operations",                    type: "Standard", guide: "https://salesresources.cisco.com/Link/Content/DCC6qVR97QGWH8fX7DjRdCRWgHCB" },
  { portfolio: "Collaboration",             offer: "Webex Suite",                   useCase: "Webex Calling and App",                                  type: "Standard", guide: null },
  { portfolio: "Collaboration",             offer: "Cisco Contact Center",          useCase: "Webex Contact Center",                                   type: "Advanced", guide: null }
];

// Lookup: offer name (normalised upper) → portfolio
var OFFER_TO_PORTFOLIO = (function () {
  var map = {};
  CPI_MAPPING.forEach(function (entry) {
    map[entry.offer.toUpperCase()] = entry.portfolio;
  });
  return map;
}());

// Lookup: use case name (normalised upper) → portfolio
var USE_CASE_TO_PORTFOLIO = (function () {
  var map = {};
  CPI_MAPPING.forEach(function (entry) {
    map[entry.useCase.toUpperCase()] = entry.portfolio;
  });
  return map;
}());

// Lookup: use case name (normalised upper) → offer
var USE_CASE_TO_OFFER = (function () {
  var map = {};
  CPI_MAPPING.forEach(function (entry) {
    map[entry.useCase.toUpperCase()] = entry.offer;
  });
  return map;
}());

// Lookup: use case name → guide URL
var UC_GUIDE_MAP = (function () {
  var map = {};
  CPI_MAPPING.forEach(function (entry) {
    if (entry.guide) map[entry.useCase] = entry.guide;
  });
  return map;
}());

// Lookup: use case name (normalised upper) → incentive type ("Standard" / "Advanced")
var UC_TYPE_MAP = (function () {
  var map = {};
  CPI_MAPPING.forEach(function (entry) {
    if (entry.type) map[entry.useCase.toUpperCase()] = entry.type;
  });
  return map;
}());

// Lookup: use case name → criteria image path (relative to app root)
var UC_CRITERIA_MAP = {
  "Campus Network Automation":                              "criteria/Campus Network Automation.jpg",
  "Campus Network Observability and Insights":             "criteria/Campus Network Observability and Insights.jpg",
  "Campus Network Programmability and Integrations":       "criteria/Campus Network Programmability and Integration.jpg",
  "Campus Network Segmentation":                           "criteria/Campus Network Segmentation.jpg",
  "Campus Network Visibility":                             "criteria/Campus Network Visibility.jpg",
  "Cloud Monitoring for Catalyst":                         "criteria/Cloud Monitoring for Catalyst.jpg",
  "Internet and Cloud Visibility":                         "criteria/Internet and Cloud Visibility.jpg",
  "Location Based Intelligence":                           "criteria/Location Based Intelligence.jpg",
  "Foundational Networking and Security for Meraki":       "criteria/Foundational Networking and Security for Meraki.jpg",
  "Programmability and Integrations for Meraki":           "criteria/Programmability and Integrations for Meraki.jpg",
  "Multicloud Connectivity":                               "criteria/Multicloud Connectivity.jpg",
  "SD-Routing":                                            "criteria/SD-Routing.jpg",
  "Secure Automated WAN":                                  "criteria/Secure Automated WAN.jpg",
  "Network Security Analytics":                            "criteria/Network Security Analytics.jpg",
  "Secure Application Access With Phishing-Resistant MFA": "criteria/Secure Application Access with Phishing-Resistant MFA.jpg",
  "DNS Security":                                          "criteria/DNS Security.jpg",
  "Public Cloud Security Policy and Access":               "criteria/Public Cloud Security Policy and Access.jpg",
  "Data Center Firewall Operations":                       "criteria/Data Center Firewall Operations.jpg",
  "Internet Edge Protection":                              "criteria/Internet Edge Protection.jpg",
  "Network Access Control":                                "criteria/Network Access Control.jpg",
  "Secure Internet Access":                               "criteria/Secure Internet Access.jpg",
  "Secure Private Access":                                "criteria/Secure Private Access.jpg",
  "DNS Defense":                                          "criteria/DNS Defense.jpg",
  "Simplified Operations":                                 "criteria/Simplified Operations.jpg",
  "Data Center Network Operations":                        "criteria/Data Center Network Operations.jpg",
  "Distributed Networking":                                "criteria/Distributed Networking.jpg",
  "Distributed Networking with NDFC (DCNM)":               "criteria/Distributed Networking with NDFC (DCNM).jpg",
  "Fabric Provisioning and Operations with NDFC (DCNM)":   "criteria/Fabric Provisioning and Operations with NDFC (DCNM).jpg",
  "Network Provisioning and Operations":                   "criteria/Network Provisioning and Operations.jpg",
  "Webex Calling and App":                                 "criteria/Webex Calling and App.jpg",
  "Webex Contact Center":                                  "criteria/Webex Contact Center.jpg"
};

