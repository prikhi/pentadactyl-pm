// options.js
//
// handles all persistent storage of information
// to and from the firefox registry

const TYPE = 4;
const SETFUNC = 6;
const GETFUNC = 7;
const DEFAULT = 8;
const CHECKFUNC = 9;


// the global handle to the root of the firefox options
var g_firefox_prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
var g_vimperator_prefs = null;

// non persistent options
var opt_usermode = false;
var opt_fullscreen = false;

/* all user-setable vimperator options
 * format:
 * [
 *     0: [all names of this option],
 *     1: usage,
 *     2: shorthelp
 *     3: help text,
 *     4: type,
 *     5: completefunc
 *     6: set_function,
 *     7: get_function,
 *     8: default,
 *     9: checkfunc,
 * ]
 */
var g_options = [/*{{{*/
    [
        ["activate"],
        ["activate"],
        "Define when tabs are automatically activated",
        "Not implemented yet",
        "stringlist",
        null,
        function(value) { set_pref("activate", value); },
        function() { return get_pref("activate"); },
        "quickmark,tabopen,paste",
        null
    ],
    [
        ["beep", "nobeep"],
        ["beep"],
        "Emit a pc speaker beep on certain errors",
        null,
        "boolean",
        null,
        function(value) { set_pref("beep", value); },
        function() { return get_pref("beep"); },
        true,
        null
    ],
    [
        ["complete", "cpt"],
        ["complete", "cpt"],
        "Items which are completed at the :[tab]open prompt",
        "Available items:<br/><ul>" +
        "<li><b>s</b>: Search machines and keyword URLs</li>" +
        "<li><b>f</b>: Local files</li>" +
        "<li><b>b</b>: Bookmarks</li>" +
        "<li><b>h</b>: History</li></ul>" +
        "The order is important, so <code class=\"command\">:set complete=bs</code> would list bookmarks first, and then any available quick searches.<br/>"+
        "Add 'sort' to the <code class=\"option\">'wildoptions'</code> option if you want all entries sorted.",
        "charlist",
        null,
        function(value) { set_pref("complete", value); },
        function() { return get_pref("complete"); },
        "sfbh",
        null
    ],
    [
        ["defsearch", "ds"],
        ["defsearch", "ds"],
        "Set the default search engine",
        "The default search engine is used in the <code class=\"command\">:[tab]open [arg]</code> command "+
        "if [arg] neither looks like a URL or like a specified search engine/keyword.",
        "string",
        function() { return [["foo", "bar"], ["shit", "blub"]]; },
        function(value) { set_pref("defsearch", value); },
        function() { return get_pref("defsearch", "google"); },
        "google",
        null
    ],
    [
        ["extendedhinttags", "eht"],
        ["extendedhinttags", "eht"],
        "XPath string of hintable elements activated by ';'",
        null,
        "string",
        null,
        function(value) { set_pref("extendedhinttags", value); },
        function() { return get_pref("extendedhinttags"); },
        "//*[@onclick or @onmouseover or @onmousedown or @onmouseup or @oncommand or @class='lk' or @class='s'] | //input[@type!='hidden' or not(boolean(@type))] | //a | //area | //iframe | //textarea | //button | //select | "+
        "//xhtml:*[@onclick or @onmouseover or @onmousedown or @onmouseup or @oncommand or @class='lk' or @class='s'] | //xhtml:input[@type!='hidden' or not(boolean(@type))] | //xhtml:a | //xhtml:area | //xhtml:iframe | //xhtml:textarea | //xhtml:button | //xhtml:select",
        null
    ],
    [
        ["focusedhintstyle", "fhs"],
        ["focusedhintstyle", "fhs"],
        "CSS specification of focused hints appearance",
        null,
        "string",
        null,
        function(value) { set_pref("focusedhintstyle", value); },
        function() { return get_pref("focusedhintstyle"); },
        "z-index:5000; font-family:monospace; font-size:12px; color:ButtonText; background-color:ButtonShadow; border-color:ButtonShadow; border-width:1px; border-style:solid; padding:0px 1px 0px 1px; position:absolute;",
        null
    ],
    [
        ["fullscreen", "fs", "nofullscreen", "nofs"],
        ["fullscreen", "fs"],
        "Shows the current window fullscreen",
        null,
        "boolean",
        null,
        function(value) { opt_fullscreen = value; BrowserFullScreen(); },
        function() { return opt_fullscreen; },
        false,
        null
    ],
    [
        ["guioptions", "go"],
        ["guioptions", "go"],
        "Shows or hides the menu, toolbar and scrollbars",
        "Supported characters:<br/><ul>"+
        "<li><b>m</b>: menubar</li>"+
        "<li><b>T</b>: toolbar</li>"+
        "<li><b>b</b>: bookmark bar</li>"+
        "<li><b>s</b>: original Firefox statusbar</li></ul>",
        "charlist",
        null,
        function(value) { set_pref("guioptions", value); set_guioptions(value); },
        function() { return get_pref("guioptions"); },
        "",
        null
    ],
    [
        ["hintchars", "hc"],
        ["hintchars", "hc"],
        "String of single characters which can be used to follow hints",
        null,
        "charlist",
        null,
        function(value) { set_pref("hintchars", value); },
        function() { return get_pref("hintchars"); },
        "hjklasdfgyuiopqwertnmzxcvb",
        null
    ],
    [
        ["hintstyle", "hs"],
        ["hintstyle", "hs"],
        "CSS specification of unfocused hints appearance",
        null,
        "string",
        null,
        function(value) { set_pref("hintstyle", value); },
        function() { return get_pref("hintstyle"); },
        "z-index:5000; font-family:monospace; font-size:12px; color:black; background-color:yellow; border-color:ButtonShadow; border-width:0px; border-style:solid; padding:0px 1px 0px 1px; position:absolute; ",
        null
    ],
    [
        ["hinttags"],
        ["hinttags"],
        "XPath string of hintable elements activated by <code class=\"mapping\">'f'</code> and <code class=\"mapping\">'F'</code>",
        null,
        "string",
        null,
        function(value) { set_pref("hinttags", value); },
        function() { return get_pref("hinttags"); },
        "//*[@onclick or @onmouseover or @onmousedown or @onmouseup or @oncommand or @class='lk' or @class='s'] | //input[@type!='hidden'] | //a | //area | //iframe | //textarea | //button | //select | "+
        "//xhtml:*[@onclick or @onmouseover or @onmousedown or @onmouseup or @oncommand or @class='lk' or @class='s'] | //xhtml:input[@type!='hidden'] | //xhtml:a | //xhtml:area | //xhtml:iframe | //xhtml:textarea | //xhtml:button | //xhtml:select",
        null
    ],
    [
        ["maxhints", "mh"],
        ["maxhints", "mh"],
        "Maximum number of simultanously shown hints",
        "If you want to speed up display of hints, choose a smaller value",
        "number",
        null,
        function(value) { set_pref("maxhints", value); },
        function() { return get_pref("maxhints"); },
        250,
        function (value) { if (value>=1 && value <=1000) return true; else return false; }
    ],
    [
        ["preload", "nopreload"],
        ["preload"],
        "Speed up first time history/bookmark completion",
        "History access can be quite slow for a large history. Vimperator maintains a cache to speed it up significantly on subsequent access.<br/>"+
        "In order to also speed up first time access, it is cached at startup, if this option is set (recommended).",
        "boolean",
        null,
        function(value) { set_pref("preload", value); },
        function() { return get_pref("preload"); },
        true,
        null
    ],
    [
        ["previewheight", "pvh"],
        ["previewheight", "pvh"],
        "Default height for preview window",
        "Value must be between 1 and 50. If the value is too high, completions may cover the command-line. "+
        "Close the preview window with <code class=\"command\">:pclose</code>.",
        "number",
        null,
        function(value) { set_pref("previewheight", value); },
        function() { return get_pref("previewheight"); },
        10,
        function (value) { if (value>=1 && value <=50) return true; else return false; }
    ],
	[
		["showmode", "smd", "noshowmode", "nosmd"],
		["showmode", "smd"],
		"Show the current mode in the command line",
        null,
		"boolean",
		null,
        function(value) { set_pref("showmode", value); },
        function() { return get_pref("showmode"); },
		true,
		null
	],
	[
		["showstatuslinks", "ssli"],
		["showstatuslinks", "ssli"],
		"Show the destination of the link under the cursor in the status bar",
        "Also links which are focused by keyboard commands like <code class=\"mapping\">&lt;Tab&gt;</code> are shown. "+
        "Possible values:<br/><ul>"+
        "<li><b>0</b>: Don't show link destination</li>" +
        "<li><b>1</b>: Show the link in the status line</li>" +
        "<li><b>2</b>: Show the link in the command line</li></ul>",
		"number",
		null,
        function(value) { set_pref("showstatuslinks", value); },
        function() { return get_pref("showstatuslinks"); },
		1,
		null
	],
    [
        ["showtabline", "stal"],
        ["showtabline", "stal"],
        "Control when to show the tab bar of opened web pages",
        "Possible values:<br/><ul>"+
        "<li><b>0</b>: Never show tab bar</li>"+
        "<li><b>1</b>: Show tab bar only if more than one tab is open</li>"+
        "<li><b>2</b>: Always show tab bar</li></ul>"+
        "Not implemented yet.",
        "number",
        null,
        function(value) { set_pref("showtabline", value); set_showtabline(value); },
        function() { return get_pref("showtabline"); },
        2,
        function (value) { if (value>=0 && value <=2) return true; else return false; }
    ],
	[
		["titlestring"],
		["titlestring"],
		"Change the title of the browser window",
		"Vimperator changes the browser title from \"Title of webpage - Mozilla Firefox\" to "+
        "\"Title of webpage - Vimperator\".<br/>If you don't like that, you can restore it with: "+
        "<code class=\"command\">:set titlestring=Mozilla Firefox</code>.",
		"string",
		null,
		function(value) { set_pref("titlestring", value); set_titlestring(value); },
		function() { return get_pref("titlestring"); },
		"Vimperator",
		null
	],
    [
        ["usermode", "um", "nousermode", "noum"],
        ["usermode", "um"],
        "Show current website with a minimal style sheet to make it easily accessible",
        "Note that this is a local option for now, later it may be split into a global and <code class=\"command\">:setlocal</code> part",
        "boolean",
        null,
        function(value) { opt_usermode = value; setStyleDisabled(value); },
        function() { return opt_usermode; },
        false,
        null
    ],
    [
        ["wildmode", "wim"],
        ["wildmode", "wim"],
        "Define how command line completion works",
        "It is a comma-separated list of parts, where each part specifies " +
        "what to do for each consecutive use of the completion key. The first part " +
        "specifies the behavior for the first use of the completion key, the second part " +
        "for the second use, etc.<br/>" +
        "These are the possible values for each part:<br/>" +
        "<table>"+
        "<tr><td><b>''</b></td><td>Complete only the first match</td></tr>" +
        "<tr><td><b>'full'</b></td><td>Complete the next full match. After the last, the original string is used.</td></tr>" +
        "<tr><td><b>'longest'</b></td><td>Complete till the longest common string.</td></tr>" +
        "<tr><td><b>'list'</b></td><td>When more than one match, list all matches.</td></tr>" +
        "<tr><td><b>'list:full'</b></td><td>When more than one match, list all matches and complete first match.</td></tr>" +
        "<tr><td><b>'list:longest'</b></td><td>When more than one match, list all matches and complete till the longest common string.</td></tr>" +
        "</table>" +
        "When there is only a single match, it is fully completed regardless of the case.",
        "stringlist",
        null,
        function(value) { set_pref("wildmode", value); },
        function() { return get_pref("wildmode"); },
        "list:full",
        null
    ],
    [
        ["wildoptions", "wop"],
        ["wildoptions", "wop"],
        "Change how command line completion is done",
        "A list of words that change how command line completion is done.<br/>"+
        "Currently only one word is allowed:<br/>"+
        "<table>"+
        "<tr><td><b>sort</b></td><td>Always sorts completion list, overriding the <code class=\"option\">'complete'</code> option.</td></tr>" +
        "</table>",
        "stringlist",
        null,
        function(value) { set_pref("wildoptions", value); },
        function() { return get_pref("wildoptions"); },
        "",
        null
    ]

    // TODO: make more performant and then enable
    /*,[
        ["numbertabs", "nt"],
        ["numbertabs", "nt"],
        "Turns tab numbering on or off",
        "If you want to see a number on each tab turn this on",
        "boolean",
        null,
        function(value) { set_pref("numbertabs", value); set_tabnumbers(value); },
        function() { return get_pref("numbertabs"); },
        false,
        null
    ],

    function set_tabnumbers(value)
    {
        if(value==false)
            vimperator.tabs.updateTitles(true);
        vimperator.tabs.updateTitles(false);
    }
*/

]/*}}}*/

// return null, if the cmd cannot be found in our g_options array, or
// otherwise a refernce to our command
function get_option(cmd)/*{{{*/
{
    for (var i=0; i < g_options.length; i++)
    {
        for (var j=0; j < g_options[i][COMMANDS].length; j++)
        {
            if (g_options[i][COMMANDS][j] == cmd)
            {
                return g_options[i];
            }
        }
    }
    return null;
}/*}}}*/

/////////////////////////////////////////////////
// preference getter functions ///////////// {{{1
/////////////////////////////////////////////////
Vimperator.prototype.getpr = function(name){
    //alert('in here');
    if (!g_vimperator_prefs)
        g_vimperator_prefs = g_firefox_prefs.getBranch("extensions.vimperator.");
        try{
    pref = g_vimperator_prefs.getCharPref(name);
    } catch(e) { pref = "no idea"; }
    return pref;
}
// does not work:
vimperator.getpref2 = function(name){
    pref = g_vimperator_prefs.getCharPref(name);
    return pref;
}

function get_pref(name, forced_default)
{
    var pref = null;
    var default_value = "";

    // sometimes this var is not yet inititialized, make sure, it is
    if (!g_vimperator_prefs)
        g_vimperator_prefs = g_firefox_prefs.getBranch("extensions.vimperator.");

    if (forced_default)  // this argument sets defaults for non-user settable options (like comp_history)
        default_value = forced_default;
    else
    {
        for (var i=0; i<g_options.length; i++)
        {
            if (g_options[i][COMMANDS][0] == name) // only first name is searched
            {
                default_value = g_options[i][DEFAULT];
                break;
            }
        }
    }

    try
    {
        if (typeof default_value == "string")
            pref = g_vimperator_prefs.getCharPref(name);
        else if (typeof default_value == "number")
            pref = g_vimperator_prefs.getIntPref(name);
        else if (typeof default_value == "boolean")
            pref = g_vimperator_prefs.getBoolPref(name);
        else
            pref = default_value;
    } catch (e)
    {
        //alert("error: " + e);
        pref = default_value;
    }
    return pref;
}
Vimperator.prototype.getpref = get_pref;


function get_firefox_pref(name, default_value)
{
    var pref;
    try
    {
        if (typeof default_value == "string")
            pref = g_firefox_prefs.getCharPref(name);
        else if (typeof default_value == "number")
            pref = g_firefox_prefs.getIntPref(name);
        else if (typeof default_value == "boolean")
            pref = g_firefox_prefs.getBoolPref(name);
        else
            pref = default_value;
    } catch (e)
    {
        pref = default_value;
    }
    return pref;
}

/////////////////////////////////////////////////
// preference setter functions ///////////// {{{1
/////////////////////////////////////////////////
function set_pref(name, value)
{
    // sometimes this var is not yet inititialized, make sure, it is
    if (!g_vimperator_prefs)
        g_vimperator_prefs = g_firefox_prefs.getBranch("extensions.vimperator.");

    if (typeof value == "string")
        g_vimperator_prefs.setCharPref(name, value);
    else if (typeof value == "number")
        g_vimperator_prefs.setIntPref(name, value);
    else if (typeof value == "boolean")
        g_vimperator_prefs.setBoolPref(name, value);
    else
        vimperator.echoerr("Unknown typeof pref: " + value);
}

function set_firefox_pref(name, value)
{
    // NOTE: firefox prefs are always inititialized, no need to re-init

    if (typeof value == "string")
        g_firefox_prefs.setCharPref(name, value);
    else if (typeof value == "number")
        g_firefox_prefs.setIntPref(name, value);
    else if (typeof value == "boolean")
        g_firefox_prefs.setBoolPref(name, value);
    else
        vimperator.echoerr("Unknown typeof pref: " + value);
}


/////////////////////////////////////////////////
// helper functions //////////////////////// {{{1
/////////////////////////////////////////////////

function set_guioptions(value)
{
    // hide menubar
    document.getElementById("toolbar-menubar").collapsed = value.indexOf("m") > -1 ? false : true;
    document.getElementById("toolbar-menubar").hidden = value.indexOf("m") > -1 ? false : true;
    // and main toolbar
    document.getElementById("nav-bar").collapsed = value.indexOf("T") > -1 ? false : true;
    document.getElementById("nav-bar").hidden = value.indexOf("T") > -1 ? false : true;
    // and bookmarks toolbar
    document.getElementById("PersonalToolbar").collapsed = value.indexOf("b") > -1 ? false : true;
    document.getElementById("PersonalToolbar").hidden = value.indexOf("b") > -1 ? false : true;
    // and original status bar (default), but show it, e.g. when needed for extensions
    document.getElementById("status-bar").collapsed = value.indexOf("s") > -1 ? false : true;
    document.getElementById("status-bar").hidden = value.indexOf("s") > -1 ? false : true;
}

function set_showtabline(value)
{
    // hide tabbar
    if(value == 0)
    {
        getBrowser().mStrip.collapsed = true;
        getBrowser().mStrip.hidden = true;
    }
    else if(value == 1)
        vimperator.echo("show tabline only with > 1 page open not impl. yet");
    else
    {
        getBrowser().mStrip.collapsed = false;
        getBrowser().mStrip.hidden = false;
    }
}

function set_titlestring(value)
{
    if (!value || typeof value != "string")
        value = get_pref("titlestring");

	document.getElementById("main-window").setAttribute("titlemodifier", value);
    document.title = window.content.document.title + " - " + value; // not perfect fix, but good enough
}

// vim: set fdm=marker sw=4 ts=4 et:
