// -----------------
// Global variables
// -----------------

// codebeat:disable[LOC,ABC,BLOCK_NESTING,ARITY]
const autoTranslate = require("./auto");
const Sequelize = require("sequelize");
const logger = require("./logger");
const Op = Sequelize.Op;
var dbNewPrefix = "";
var server_obj = {};
exports.server_obj = server_obj;

// ----------------------
// Database Auth Process
// ----------------------

console.log("DEBUG: Pre Stage Database Auth Process");
const db =  (() => { 
   // Define what kind of DB it is for Sequelize
   if (process.env.DATABASE_URL.startsWith("postgres"))
   {
      return new Sequelize(process.env.DATABASE_URL, {
         logging: console.log,
         dialectOptions: {
            ssl: {
               require: true,
               rejectUnauthorized: false
            }
         }
      });
   }
   // In other case it's SQLite for now
   else
   {
     return new Sequelize({
         dialect: "sqlite",
         dialectOptions: {
            ssl: {
               require: true,
               rejectUnauthorized: false
            }
         },
         storage: process.env.DATABASE_URL
      });
   }
})();

db
   .authenticate()
   .then(() =>
   {
      logger("dev","Successfully connected to database");
   })
   .catch(err =>
   {
      logger("error", err);
   });

// ---------------------------------
// Database server table definition
// ---------------------------------

console.log("DEBUG: Pre Stage Database server table definition");
const Servers = db.define("servers", {
   id: {
      type: Sequelize.STRING(32),
      primaryKey: true,
      unique: true,
      allowNull: false
   },
   prefix: {
      type: Sequelize.STRING(32),
      defaultValue: "!tr"
   },
   lang: {
      type: Sequelize.STRING(8),
      defaultValue: "en"
   },
   count: {
      type: Sequelize.INTEGER,
      defaultValue: 0
   },
   active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
   },
   embedstyle: {
      type: Sequelize.STRING(8),
      defaultValue: "on"
   },
   bot2botstyle: {
      type: Sequelize.STRING(8),
      defaultValue: "off"
   },
   webhookid: Sequelize.STRING(32),
   webhooktoken: Sequelize.STRING(255),
   webhookactive: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
   }
});

// --------------------------------
// Database tasks table definition
// --------------------------------

console.log("DEBUG: Pre Stage Database tasks table definition");
const Tasks = db.define("tasks", {
   origin: Sequelize.STRING(32),
   dest: Sequelize.STRING(32),
   reply: Sequelize.STRING(32),
   server: Sequelize.STRING(32),
   active: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
   },
   LangTo: {
      type: Sequelize.STRING(8),
      defaultValue: "en"
   },
   LangFrom: {
      type: Sequelize.STRING(8),
      defaultValue: "en"
   }
},
{
   indexes: [
      {
         unique: true,
         name: "ux_index_1",
         fields: ["origin", "dest", "LangTo", "LangFrom"]
      }
   ]
});

// -------------------
// Init/create tables
// -------------------

exports.initializeDatabase = async function(client)
{
   console.log("DEBUG: Stage Init/create tables - Pre Sync");
   db.sync({ logging: console.log }).then(async() =>
   {
      await this.upgradeDB();
      console.log("DEBUG: New columns should be added Before this point.");
      Servers.upsert({ id: "bot", lang: "en" });
      const guilds = client.guilds.array().length;
      const guildsArray = client.guilds.array();
      var i;
      for (i = 0; i < guilds; i++)
      {
         const guild = guildsArray[i];
         const guildID = guild.id;
         Servers.findAll({ where: { id: guildID } }).then(projects =>
         {
            if (projects.length === 0)
            {
               Servers.upsert({ id: guildID,
                  lang: "en" });
            }
         });
      }
      console.log("DEBUG: Stage Init/create tables - Pre serversFindAll");
      const serversFindAll = await Servers.findAll();
      for (let i = 0; i < serversFindAll.length; i++)
      {
         // eslint-disable-next-line prefer-const
         let guild_id = serversFindAll[i].id;
         // eslint-disable-next-line eqeqeq
         if (guild_id != "bot")
         {
            server_obj[guild_id] = { db: serversFindAll[i] };
         }
      }
      console.log("DEBUG: Stage Init/create tables - Pre guildClient");
      const guildClient = Array.from(client.guilds.values());
      for (let i = 0; i < guildClient.length; i++)
      {
         const guild = guildClient[i];
         server_obj[guild.id].guild = guild;
         server_obj[guild.id].size = guild.memberCount;
         if (!server_obj.size)
         {
            server_obj.size = 0;
         }
         server_obj.size += guild.memberCount;
      }
      console.log("----------------------------------------\nDatabase fully initialized.\n----------------------------------------");
      // });
   });
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
                        webhookid: null,
                        webhooktoken: null,
                        prefix: "!tr" }).catch(err => console.log("Server already exists error suppressed = ", err));
   server_obj[id] = {db: newServer};
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

exports.updateServerLang = function(id, lang, _cb)
{
   console.log("DEBUG: Stage Update Server Lang");
   server_obj[id].db.lang = lang;
   return server_obj[id].db.save();
};

// -------------------------------
// Update Embedded Variable in DB
// -------------------------------

exports.updateEmbedVar = function(id, embedstyle, _cb)
{
   console.log("DEBUG: Stage Update Embedded Variable in DB");
   server_obj[id].db.embedstyle = embedstyle;
   return server_obj[id].db.save();
};

// ------------------------------
// Update Bot2Bot Variable In DB
// ------------------------------

exports.updateBot2BotVar = function(id, bot2botstyle, _cb)
{
   console.log("DEBUG: Stage Update Bot2Bot Variable In DB");
   server_obj[id].db.bot2botstyle = bot2botstyle;
   return server_obj[id].db.save();
};

// -----------------------------------------------
// Update webhookID & webhookToken Variable In DB
// -----------------------------------------------

exports.updateWebhookVar = function(id, webhookid, webhooktoken, webhookactive, _cb)
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

exports.removeWebhook = function(id, _cb)
{
   console.log("DEBUG: Stage Deactivate debug Webhook");
   server_obj[id].db.webhookactive = false;
   return server_obj[id].db.save();
};

// --------------
// Update prefix
// --------------

exports.updatePrefix = function(id, prefix, _cb)
{
   console.log("DEBUG: Stage Update prefix");
   dbNewPrefix = prefix;
   server_obj[id].db.prefix = prefix;
   return server_obj[id].db.save();
};

//---------------------------------------------------------------------------------------------
//-- All this function are for DB upgrades
//---------------------------------------------------------------------------------------------
// -----------------------------
// Adding a column in DB if not exists
// -----------------------------
exports.updateColumn = async function(tableName, columnName, columnType, columnDefault)
{
   await db.getQueryInterface().describeTable(tableName).then(tableDefinition =>
      {
         if (!tableDefinition[`${columnName}`])
         {
            console.log("--> Adding "+ columnName + " column");
            if (columnDefault === null)
            {
               db.getQueryInterface().addColumn(tableName, columnName, {type: columnType});
            }
            else 
            {
               db.getQueryInterface().addColumn(tableName, columnName, {
                  type: columnType,
                  defaultValue: columnDefault});
            }
         }
      });
}

// -----------------------------
// Upgrade DB to new version of RITA
// -----------------------------
exports.upgradeDB = async function(data)
{
   console.log("DEBUG: Stage Add Missing Variable Columns");
   // For older version of RITA, they need to upgrade DB with adding new columns if needed
   await this.updateColumn("servers", "prefix", Sequelize.STRING(32), "!tr");
   await this.updateColumn("servers", "embedstyle", Sequelize.STRING(8), "on");
   await this.updateColumn("servers", "bot2botstyle",  Sequelize.STRING(8), "off");
   await this.updateColumn("servers", "webhookid", Sequelize.STRING(32));
   await this.updateColumn("servers", "webhooktoken", Sequelize.STRING(255));
   await this.updateColumn("servers", "webhookactive", Sequelize.BOOLEAN, false);
   console.log("DEBUG: All New Columns Added");

   // For older version of RITA, must remove old unique index
   console.log("DEBUG: Stage Remove old Unique index");
   db.getQueryInterface().removeIndex("tasks", "tasks_origin_dest");
   console.log("DEBUG : All old index removed");
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
         err => this.upgradeDB() //+ logger("error", err + "\nQuery: " + err.sql, "db")
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