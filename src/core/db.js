// -----------------
// Global variables
// -----------------

// codebeat:disable[LOC,ABC,BLOCK_NESTING,ARITY]
const autoTranslate = require("./auto");
const Sequelize = require("sequelize");
const logger = require("./logger");
const DbInit = require("./db.init")
const Op = Sequelize.Op;
var dbNewPrefix = "";
var server_obj = {};
exports.server_obj = server_obj;

// ----------------------
// Database definition
// ----------------------
const db = DbInit.getDbInstance();
const Servers = DbInit.defineServers(db);
const Tasks = DbInit.defineTasks(db);

// ----------------------------------
// Initialise db 
// -----------------------------------
exports.initializeDatabase = async function(client)
{
   // Initialize DB and variables
   await DbInit.onStartup(db, client, Servers, server_obj);
};

// -----------------------
// Add Server to Database
// -----------------------
exports.addServer = async function(id, lang)
{
   console.log("DEBUG: Stage Add Server to Database");
   newServer = await Servers.create({  
                        embedstyle: "on",
                        bot2botstyle: "off",
                        id: id,
                        lang: lang,
                        webhookid: null,
                        webhooktoken: null,
                        prefix: "!tr" }).catch(err => console.log("Server already exists error suppressed = ", err));
};

// ------------------
// Deactivate Server
// ------------------
exports.removeServer = function(id)
{
   console.log("DEBUG: Stage Deactivate Server");
   server_obj[id].db.active = false;
   return server_obj[id].db.save();
};

// -------------------
// Update Server Lang
// -------------------
exports.updateServerLang = function(id, lang)
{
   console.log("DEBUG: Stage Update Server Lang");
   server_obj[id].db.lang = lang;
   return server_obj[id].db.save();
};

// -------------------------------
// Update Embedded Variable in DB
// -------------------------------
exports.updateEmbedVar = function(id, embedstyle)
{
   console.log("DEBUG: Stage Update Embedded Variable in DB");
   server_obj[id].db.embedstyle = embedstyle;
   return server_obj[id].db.save();
};

// ------------------------------
// Update Bot2Bot Variable In DB
// ------------------------------
exports.updateBot2BotVar = function(id, bot2botstyle)
{
   console.log("DEBUG: Stage Update Bot2Bot Variable In DB");
   server_obj[id].db.bot2botstyle = bot2botstyle;
   return server_obj[id].db.save();
};

// -----------------------------------------------
// Update webhookID & webhookToken Variable In DB
// -----------------------------------------------
exports.updateWebhookVar = function(id, webhookid, webhooktoken, webhookactive)
{
   console.log("DEBUG: Stage Update webhookID & webhookToken Variable In DB");
   server_obj[id].db.webhookid = webhookid;
   server_obj[id].db.webhooktoken = webhooktoken;
   server_obj[id].db.webhookactive = webhookactive;
   return server_obj[id].db.save();
};

// -------------------------
// Deactivate debug Webhook
// -------------------------
exports.removeWebhook = function(id)
{
   console.log("DEBUG: Stage Deactivate debug Webhook");
   server_obj[id].db.webhookactive = false;
   return server_obj[id].db.save();
};

// --------------
// Update prefix
// --------------

exports.updatePrefix = function(id, prefix)
{
   console.log("DEBUG: Stage Update prefix");
   dbNewPrefix = prefix;
   server_obj[id].db.prefix = prefix;
   return server_obj[id].db.save();
};


// ------------------
// Get Channel Tasks
// ------------------

exports.channelTasks = function(data)
{
   console.log("DEBUG: Stage Get Channel Tasks");
   var id = data.message.channel.id;
   if (data.message.channel.type === "dm")
   {
      id = "@" + data.message.author.id;
   }
   try
   {
      const taskList = Tasks.findAll({ where: { origin: id,
         active: true }}).then(
         function (result)
         {
            data.rows = result;
            return autoTranslate(data);
         });
   }
   catch (e)
   {
      logger("error", e);
      data.err = e;
      return autoTranslate(data);
   }
};
// ------------------------------
// Get tasks for channel or user
// ------------------------------

exports.getTasks = function(origin, dest, cb)
{
   console.log("DEBUG: Stage Get tasks for channel or user");
   if (dest === "me")
   {
      return Tasks.findAll({ where: { origin: origin,
         dest: dest } }, {raw: true}).then(
         function (result, err)
         {
            cb(err, result);
         });
   }
   return Tasks.findAll({ where: { origin: origin } }, {raw: true}).then(
      function (result, err)
      {
         cb(err, result);
      });
};

// --------------------------------
// Check if dest is found in tasks
// --------------------------------

exports.checkTask = function(origin, dest, cb)
{
   console.log("DEBUG: Stage Check if dest is found in tasks");
   if (dest === "all")
   {
      return Tasks.findAll({ where: { origin: origin } }, {raw: true}).then(
         function (result, err)
         {
            cb(err, result);
         });
   }
   return Tasks.findAll({ where: { origin: origin,
      dest: dest } }, {raw: true}).then(
      function (result, err)
      {
         cb(err, result);
      });
};

// --------------------
// Remove Channel Task
// --------------------

exports.removeTask = function(origin, dest, cb)
{
   console.log("DEBUG: Stage Remove Channel Task");
   if (dest === "all")
   {
      console.log("removeTask() - all");
      return Tasks.destroy({ where: { [Op.or]: [{ origin: origin },{ dest: origin }] } }).then(
         function (err, result)
         {
            cb(null, result);
         });
   }
   return Tasks.destroy({ where: { [Op.or]: [{ origin: origin,
      dest: dest },{ origin: dest,
      dest: origin }] } }).then(
      function (err, result)
      {
         cb(null, result);
      });
};

// ---------------
// Get Task Count
// ---------------

exports.getTasksCount = function(origin, cb)
{
   console.log("Get Task Count");
   return Tasks.count({ where: {"origin": origin }}).then(c =>
   {
      cb("", c);
   });
};

// ------------------
// Get Servers Count
// ------------------

exports.getServersCount = function()
{
   console.log("DEBUG: Stage Get Servers Count");
   return server_obj.length();
};

// ---------
// Add Task
// ---------

exports.addTask = function(task)
{
   console.log("DEBUG: Stage Add Task");
   task.dest.forEach(dest =>
   {
      Tasks.upsert({
         origin: task.origin,
         dest: dest,
         reply: task.reply,
         server: task.server,
         active: true,
         LangTo: task.to,
         LangFrom: task.from
      }).then(() =>
      {
         logger("dev", "Task added successfully.");
      })
         .catch(err =>
         {
            logger("error", err, "command", task.server);
         });
   });
};

// ------------
// Update stat
// ------------

exports.increaseServers = function(id)
{
   console.log("DEBUG: Stage Update stat");
   return Servers.increment("count", { where: { id: id }});
};

// --------------
// Get bot stats
// --------------

exports.getStats = function(callback)
{
   console.log("DEBUG: Stage Get bot stats");
   return db.query(`select * from (select sum(count) as "totalCount", ` +
  `count(id)-1 as "totalServers" from servers) as table1, ` +
  `(select count(id)-1 as "activeSrv" from servers where active = TRUE) as table2, ` +
  `(select lang as "botLang" from servers where id = 'bot') as table3, ` +
  `(select count(distinct origin) as "activeTasks" ` +
  `from tasks where active = TRUE) as table4, ` +
  `(select count(distinct origin) as "activeUserTasks" ` +
  `from tasks where active = TRUE and origin like '@%') as table5;`, { type: Sequelize.QueryTypes.SELECT})
      .then(
         result => callback(result),
         err => logger("error", err + "\nQuery: " + err.sql, "db")
      );
};

// ----------------
// Get server info
// ----------------

exports.getServerInfo = function(id, callback)
{
   console.log("DEBUG: Stage Get server info");
   return db.query(`select * from (select count as "count",` +
   `lang as "lang" from servers where id = ?) as table1,` +
   `(select count(distinct origin) as "activeTasks"` +
   `from tasks where server = ?) as table2,` +
   `(select count(distinct origin) as "activeUserTasks"` +
   `from tasks where origin like '@%' and server = ?) as table3, ` +
   `(select embedstyle as "embedstyle" from servers where id = ?) as table4, ` +
   `(select bot2botstyle as "bot2botstyle" from servers where id = ?) as table5, ` +
   `(select webhookactive as "webhookactive" from servers where id = ?) as table6,` +
   `(select webhookid as "webhookid" from servers where id = ?) as table7,` +
   `(select webhooktoken as "webhooktoken" from servers where id = ?) as table8,` +
   `(select prefix as "prefix" from servers where id = ?) as table9;`, { replacements: [ id, id, id, id, id, id, id, id, id],
      type: db.QueryTypes.SELECT})
      .then(
         result => callback(result),
         err => logger("error", err + "\nQuery: " + err.sql, "db") //this.upgradeDB()
      );
};

// ---------
// Close DB
// ---------

exports.close = function()
{
   console.log("DEBUG: Stage Close DB");
   return db.close();
};