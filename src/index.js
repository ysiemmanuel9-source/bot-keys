require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
const { createClient } = require("@supabase/supabase-js");

const projects = loadProjects();
const projectById = new Map(projects.map((project) => [project.id, project]));
const supabaseByProject = new Map();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  await registerCommands();
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction).catch(() => {});
    return;
  }

  if (interaction.isButton()) {
    await handleKeyButton(interaction).catch(async (error) => {
      console.error(error);
      const content = `No pude completar eso: ${cleanError(error)}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content, embeds: [], components: [] }).catch(() => {});
      } else {
        await interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    });
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "preparar-canales") {
      await handleSetup(interaction);
      return;
    }

    if (interaction.commandName === "crear-key") {
      await handleKeyCreate(interaction);
      return;
    }

    if (interaction.commandName === "ver-keys") {
      await handleKeyList(interaction);
      return;
    }

    if (interaction.commandName === "bloquear-key") {
      await handleKeyStatus(interaction, "blocked");
      return;
    }

    if (interaction.commandName === "pausar-key") {
      await handleKeyStatus(interaction, "paused");
      return;
    }

    if (interaction.commandName === "activar-key") {
      await handleKeyStatus(interaction, "available");
      return;
    }

    if (interaction.commandName === "liberar-dispositivo") {
      await handleKeyRelease(interaction);
      return;
    }

    if (interaction.commandName === "eliminar-key") {
      await handleKeyDelete(interaction);
      return;
    }

    if (interaction.commandName === "bloquear-todas") {
      await handleBulk(interaction, "block_all");
      return;
    }

    if (interaction.commandName === "eliminar-bloqueadas") {
      await handleBulk(interaction, "delete_blocked");
      return;
    }

    if (interaction.commandName === "eliminar-todas") {
      await handleBulk(interaction, "delete_all");
      return;
    }

    await interaction.reply({ content: "Comando no reconocido.", ephemeral: true });
  } catch (error) {
    console.error(error);
    const content = `No pude completar eso: ${cleanError(error)}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content, embeds: [] }).catch(() => {});
    } else {
      await interaction.reply({ content, ephemeral: true }).catch(() => {});
    }
  }
});

client.login(requiredEnv("DISCORD_TOKEN"));

function loadProjects() {
  const filePath = path.join(__dirname, "..", "projects.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return data.map((project) => {
    for (const key of ["id", "name", "keyPrefix", "roleName", "channelName", "supabaseUrl", "supabaseAnonKey"]) {
      if (!project[key]) throw new Error(`Falta ${key} en projects.json`);
    }
    return project;
  });
}

async function registerCommands() {
  const guildId = requiredEnv("GUILD_ID");
  const rest = new REST({ version: "10" }).setToken(requiredEnv("DISCORD_TOKEN"));
  const commands = buildCommands().map((command) => command.toJSON());
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
  console.log(`Comandos registrados en el servidor ${guildId}`);
}

function buildCommands() {
  const projectOption = (option) =>
    option
      .setName("proyecto")
      .setDescription("Proyecto de keys")
      .setRequired(true)
      .setAutocomplete(true);

  const keyOption = (option) =>
    option
      .setName("key")
      .setDescription("Key exacta")
      .setRequired(true);

  return [
    new SlashCommandBuilder()
      .setName("preparar-canales")
      .setDescription("Crear los canales privados y roles de cada proyecto")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
      .setName("crear-key")
      .setDescription("Crear una o varias keys para un proyecto")
      .addStringOption(projectOption)
      .addStringOption((option) =>
        option
          .setName("cliente")
          .setDescription("Nombre del cliente o comprador")
          .setRequired(true)
          .setMaxLength(120)
      )
      .addStringOption((option) =>
        option
          .setName("tipo-duracion")
          .setDescription("Elige si la duracion sera por horas, dias, semanas o meses")
          .addChoices(
            { name: "sin vencimiento", value: "none" },
            { name: "horas", value: "hours" },
            { name: "dias", value: "days" },
            { name: "semanas", value: "weeks" },
            { name: "meses", value: "months" }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("cantidad-duracion")
          .setDescription("Cantidad de horas, dias, semanas o meses")
          .setMinValue(0)
      )
      .addIntegerOption((option) =>
        option
          .setName("cantidad")
          .setDescription("Cantidad de keys")
          .setMinValue(1)
          .setMaxValue(5)
      ),

    new SlashCommandBuilder()
      .setName("ver-keys")
      .setDescription("Buscar y ver las keys de un proyecto")
      .addStringOption(projectOption)
      .addStringOption((option) =>
        option
          .setName("buscar")
          .setDescription("Buscar por key, cliente, dispositivo o IP")
          .setMaxLength(120)
      )
      .addStringOption((option) =>
        option
          .setName("estado")
          .setDescription("Filtrar por estado")
          .addChoices(
            { name: "disponible", value: "available" },
            { name: "activa", value: "active" },
            { name: "bloqueada", value: "blocked" },
            { name: "pausada", value: "paused" },
            { name: "expirada", value: "expired" }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("limite")
          .setDescription("Maximo de resultados")
          .setMinValue(1)
          .setMaxValue(5)
      ),

    new SlashCommandBuilder()
      .setName("bloquear-todas")
      .setDescription("Bloquear todas las keys de un proyecto")
      .addStringOption(projectOption)
      .addStringOption((option) =>
        option
          .setName("confirmar")
          .setDescription("Escribe BLOQUEAR para confirmar")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("eliminar-bloqueadas")
      .setDescription("Eliminar keys bloqueadas o expiradas")
      .addStringOption(projectOption)
      .addStringOption((option) =>
        option
          .setName("confirmar")
          .setDescription("Escribe ELIMINAR para confirmar")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("eliminar-todas")
      .setDescription("Bloquear y eliminar todas las keys de un proyecto")
      .addStringOption(projectOption)
      .addStringOption((option) =>
        option
          .setName("confirmar")
          .setDescription("Escribe ELIMINAR TODO para confirmar")
          .setRequired(true)
      ),
  ];
}

async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "proyecto") {
    await interaction.respond([]);
    return;
  }

  const value = String(focused.value || "").toLowerCase();
  const options = projectsForInteraction(interaction)
    .filter((project) => {
      const haystack = `${project.name} ${project.id} ${project.keyPrefix}`.toLowerCase();
      return !value || haystack.includes(value);
    })
    .slice(0, 25)
    .map((project) => ({ name: project.name, value: project.id }));

  await interaction.respond(options);
}

async function handleSetup(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "Solo alguien con permiso de administrar servidor puede hacer setup.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  const adminRoleName = process.env.KEYS_ADMIN_ROLE || "KEYS ADMIN";
  const categoryName = process.env.KEYS_CATEGORY_NAME || "KEYS - APPS";

  const adminRole = await ensureRole(guild, adminRoleName, "#8b5cf6");
  const category = await ensureCategory(guild, categoryName, adminRole);
  const made = [];

  for (const project of projects) {
    const role = await ensureRole(guild, project.roleName, "#7c3aed");
    const channel = await ensureProjectChannel(guild, category, project, role, adminRole);
    made.push(`• ${project.name}: #${channel.name} / rol ${role.name}`);
  }

  await interaction.editReply(`Listo. Cree/revise los canales privados:\n${made.join("\n")}`);
}

async function handleKeyCreate(interaction) {
  const project = getProjectFromInteraction(interaction);
  if (!(await canUseProject(interaction, project))) return;
  await interaction.deferReply();

  const clientName = interaction.options.getString("cliente", true).trim();
  const quantity = interaction.options.getInteger("cantidad") || 1;
  const duration = interaction.options.getInteger("cantidad-duracion") || 0;
  const unit = interaction.options.getString("tipo-duracion") || "none";

  const durationHours = durationToHours(duration, unit);
  const supabase = await supabaseFor(project);
  const { data, error } = await supabase.rpc("admin_generate_licenses", {
    p_quantity: quantity,
    p_duration_hours: durationHours,
    p_label: clientName,
    p_capabilities: [],
    p_custom_license_key: null,
  });
  if (error || data?.success === false) throw error || new Error(data?.message || "No se pudieron crear las keys.");

  const keys = Array.isArray(data?.keys) ? data.keys : [];
  const embed = new EmbedBuilder()
    .setTitle(`${project.name} - key creada`)
    .setColor(0x7c3aed)
    .setDescription(keys.length ? keys.map((key) => `Key: ${hiddenKey(key)}`).join("\n") : "No se devolvieron keys.")
    .addFields(
      { name: "Cliente", value: clientName, inline: true },
      { name: "Cantidad", value: String(keys.length || quantity), inline: true },
      { name: "Duracion", value: durationLabel(duration, unit), inline: true }
    )
    .setFooter({ text: "La key queda guardada en este canal. Usa los botones para administrarla." });

  await interaction.editReply({ embeds: [embed], components: keyActionRows(project, keys) });
}

async function handleKeyList(interaction) {
  const project = getProjectFromInteraction(interaction);
  if (!(await canUseProject(interaction, project))) return;
  await interaction.deferReply();

  const search = (interaction.options.getString("buscar") || "").trim().toLowerCase();
  const status = interaction.options.getString("estado");
  const limit = interaction.options.getInteger("limite") || 5;
  const supabase = await supabaseFor(project);
  const { data, error } = await supabase.rpc("admin_list_licenses");
  if (error) throw error;

  let rows = Array.isArray(data) ? data : [];
  if (status) rows = rows.filter((row) => row.status === status);
  if (search) rows = rows.filter((row) => searchableLicense(row).includes(search));
  rows = rows.slice(0, limit);

  const description = rows.length
    ? rows.map(formatLicenseLine).join("\n\n")
    : "No encontre keys con ese filtro.";

  const embed = new EmbedBuilder()
    .setTitle(`${project.name} - keys`)
    .setColor(0x7c3aed)
    .setDescription(description.slice(0, 3900))
    .setFooter({ text: rows.length ? "Usa los botones para administrar sin copiar la key." : `Mostrando ${rows.length} resultado(s)` });

  const keys = rows.map((row) => row.license_key).filter(Boolean);
  await interaction.editReply({ embeds: [embed], components: keyActionRows(project, keys) });
}

async function handleKeyButton(interaction) {
  const parsed = parseKeyButtonId(interaction.customId);
  if (!parsed) {
    await interaction.reply({ content: "Boton no reconocido.", ephemeral: true });
    return;
  }

  const project = projectById.get(parsed.projectId);
  if (!project) {
    await interaction.reply({ content: "Proyecto no configurado.", ephemeral: true });
    return;
  }
  if (!(await canUseProject(interaction, project))) return;

  await interaction.deferReply();
  const supabase = await supabaseFor(project);
  const key = normalizeKey(parsed.key);
  let message;

  if (parsed.action === "block") {
    const { data, error } = await supabase.rpc("admin_set_license_status", { p_license_key: key, p_status: "blocked" });
    if (error || data?.success === false) throw error || new Error(data?.message || "No se pudo bloquear.");
    message = `Key bloqueada: ${hiddenKey(key)}`;
    await removeSourceKeyMessage(interaction);
  } else if (parsed.action === "pause") {
    const { data, error } = await supabase.rpc("admin_set_license_status", { p_license_key: key, p_status: "paused" });
    if (error || data?.success === false) throw error || new Error(data?.message || "No se pudo pausar.");
    message = `Key pausada: ${hiddenKey(key)}`;
  } else if (parsed.action === "enable") {
    const { data, error } = await supabase.rpc("admin_set_license_status", { p_license_key: key, p_status: "available" });
    if (error || data?.success === false) throw error || new Error(data?.message || "No se pudo activar.");
    message = `Key activada: ${hiddenKey(key)}`;
  } else if (parsed.action === "release") {
    const { data, error } = await supabase.rpc("admin_reset_license_device", { p_license_key: key });
    if (error || data?.success === false) throw error || new Error(data?.message || "No se pudo liberar.");
    message = `Dispositivo liberado: ${hiddenKey(key)}`;
  } else if (parsed.action === "delete") {
    const block = await supabase.rpc("admin_set_license_status", { p_license_key: key, p_status: "blocked" });
    if (block.error) throw block.error;
    const { data, error } = await supabase.rpc("admin_delete_license", { p_license_key: key });
    if (error || data?.success === false) throw error || new Error(data?.message || "No se pudo eliminar.");
    message = `Key eliminada: ${hiddenKey(key)}`;
    await removeSourceKeyMessage(interaction);
  } else {
    await interaction.editReply("Accion no reconocida.");
    return;
  }

  await interaction.editReply(message);
  if (parsed.action === "block" || parsed.action === "delete") {
    setTimeout(() => {
      interaction.deleteReply().catch(() => {});
    }, 5000);
  }
}

async function removeSourceKeyMessage(interaction) {
  await interaction.message.delete().catch(async () => {
    await interaction.message.edit({ components: [] }).catch(() => {});
  });
}

async function handleKeyStatus(interaction, status) {
  const project = getProjectFromInteraction(interaction);
  if (!(await canUseProject(interaction, project))) return;
  await interaction.deferReply({ ephemeral: true });

  const key = normalizeKey(interaction.options.getString("key"));
  const supabase = await supabaseFor(project);
  const { data, error } = await supabase.rpc("admin_set_license_status", {
    p_license_key: key,
    p_status: status,
  });
  if (error || data?.success === false) throw error || new Error(data?.message || "No se pudo cambiar el estado.");
  await interaction.editReply(`Listo: \`${key}\` ahora esta en estado \`${status}\`.`);
}

async function handleKeyRelease(interaction) {
  const project = getProjectFromInteraction(interaction);
  if (!(await canUseProject(interaction, project))) return;
  await interaction.deferReply({ ephemeral: true });

  const key = normalizeKey(interaction.options.getString("key"));
  const supabase = await supabaseFor(project);
  const { data, error } = await supabase.rpc("admin_reset_license_device", {
    p_license_key: key,
  });
  if (error || data?.success === false) throw error || new Error(data?.message || "No se pudo liberar la key.");
  await interaction.editReply(`Listo: dispositivo liberado para \`${key}\`.`);
}

async function handleKeyDelete(interaction) {
  const project = getProjectFromInteraction(interaction);
  if (!(await canUseProject(interaction, project))) return;
  await interaction.deferReply({ ephemeral: true });

  const key = normalizeKey(interaction.options.getString("key"));
  const supabase = await supabaseFor(project);
  const block = await supabase.rpc("admin_set_license_status", {
    p_license_key: key,
    p_status: "blocked",
  });
  if (block.error) throw block.error;

  const { data, error } = await supabase.rpc("admin_delete_license", {
    p_license_key: key,
  });
  if (error || data?.success === false) throw error || new Error(data?.message || "No se pudo eliminar la key.");
  await interaction.editReply(`Listo: \`${key}\` fue bloqueada y eliminada.`);
}

async function handleBulk(interaction, mode) {
  const project = getProjectFromInteraction(interaction);
  if (!(await canUseProject(interaction, project))) return;

  const confirm = (interaction.options.getString("confirmar") || "").trim().toUpperCase();
  const expected = mode === "block_all" ? "BLOQUEAR" : mode === "delete_blocked" ? "ELIMINAR" : "ELIMINAR TODO";
  if (confirm !== expected) {
    await interaction.reply({ content: `Para confirmar escribe exactamente: \`${expected}\`.`, ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const supabase = await supabaseFor(project);
  const rpc = mode === "block_all"
    ? "admin_block_all_licenses"
    : mode === "delete_blocked"
      ? "admin_delete_blocked_or_expired_licenses"
      : "admin_block_and_delete_all_licenses";
  const { data, error } = await supabase.rpc(rpc);
  if (error || data?.success === false) throw error || new Error(data?.message || "Operacion masiva fallida.");

  const count = data?.blocked_count ?? data?.deleted_count ?? 0;
  await interaction.editReply(`Listo en ${project.name}: ${count} key(s) afectadas.`);
}

async function supabaseFor(project) {
  const cached = supabaseByProject.get(project.id);
  if (cached) return cached;

  const email = process.env[project.adminEmailEnv];
  const password = process.env[project.adminPasswordEnv];
  if (!email || !password) {
    throw new Error(`Falta configurar ${project.adminEmailEnv} y ${project.adminPasswordEnv} en .env`);
  }

  const supabase = createClient(project.supabaseUrl, project.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${project.name}: login Supabase fallo: ${error.message}`);
  supabaseByProject.set(project.id, supabase);
  return supabase;
}

async function ensureRole(guild, name, color) {
  const existing = guild.roles.cache.find((role) => role.name === name);
  if (existing) return existing;
  return guild.roles.create({
    name,
    color,
    mentionable: true,
    reason: "Key server setup",
  });
}

async function ensureCategory(guild, name, adminRole) {
  const existing = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === name);
  if (existing) return existing;

  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: adminRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
      },
    ],
    reason: "Key server setup",
  });
}

async function ensureProjectChannel(guild, category, project, role, adminRole) {
  const topic = `Canal privado para keys de ${project.name}. Usa /crear-key y /ver-keys. Los botones administran cada key.`;
  const existing = guild.channels.cache.find((channel) => channel.type === ChannelType.GuildText && channel.name === project.channelName);
  if (existing) {
    const changes = {};
    if (existing.parentId !== category.id) changes.parent = category.id;
    if (existing.topic !== topic) changes.topic = topic;
    if (Object.keys(changes).length) {
      await existing.edit({ ...changes, reason: "Actualizar canal de keys" });
      await existing.send(commandHelpMessage(project, role, true)).catch(() => {});
    }
    return existing;
  }

  const channel = await guild.channels.create({
    name: project.channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: role.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: adminRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
      },
    ],
    reason: `Key channel for ${project.name}`,
  });

  await channel.send(commandHelpMessage(project, role, false));
  return channel;
}

function commandHelpMessage(project, role, updated) {
  return [
    updated ? `Comandos actualizados para **${project.name}**.` : `Canal de **${project.name}**.`,
    `Rol permitido: \`${role.name}\`.`,
    "Comandos utiles: `/crear-key` y `/ver-keys`. Los botones del mensaje sirven para bloquear, pausar, activar, liberar o eliminar.",
  ].join("\n");
}

async function canUseProject(interaction, project) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "Esto solo funciona dentro del servidor.", ephemeral: true });
    return false;
  }

  const adminRoleName = process.env.KEYS_ADMIN_ROLE || "KEYS ADMIN";
  const member = interaction.member;
  const hasProjectRole = member.roles.cache.some((role) => role.name === project.roleName);
  const hasAdminRole = member.roles.cache.some((role) => role.name === adminRoleName);
  const canManageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

  if (hasProjectRole || hasAdminRole || canManageGuild) return true;

  await interaction.reply({
    content: `No tienes permiso para ${project.name}. Necesitas el rol \`${project.roleName}\`.`,
    ephemeral: true,
  });
  return false;
}

function projectsForInteraction(interaction) {
  const channelProject = projects.find((project) => interaction.channel?.name === project.channelName);
  if (channelProject) return [channelProject];

  const adminRoleName = process.env.KEYS_ADMIN_ROLE || "KEYS ADMIN";
  const member = interaction.member;
  const hasAdminRole = member?.roles?.cache?.some((role) => role.name === adminRoleName);
  const canManageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (hasAdminRole || canManageGuild) return projects;

  const allowed = projects.filter((project) =>
    member?.roles?.cache?.some((role) => role.name === project.roleName)
  );
  return allowed.length ? allowed : projects;
}

function getProjectFromInteraction(interaction) {
  const id = interaction.options.getString("proyecto");
  const project = projectById.get(id);
  if (!project) throw new Error("Proyecto no configurado.");
  return project;
}

function durationToHours(duration, unit) {
  if (unit === "none" || !duration || duration <= 0) return null;
  if (unit === "months") return duration * 24 * 30;
  if (unit === "weeks") return duration * 24 * 7;
  if (unit === "days") return duration * 24;
  return duration;
}

function durationLabel(duration, unit) {
  if (unit === "none" || !duration || duration <= 0) return "Sin vencimiento";
  const labels = {
    hours: "hora(s)",
    days: "dia(s)",
    weeks: "semana(s)",
    months: "mes(es)",
  };
  return `${duration} ${labels[unit] || "hora(s)"}`;
}

function keyActionRows(project, keys) {
  return keys.slice(0, 5).map((key) =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(keyButtonId("block", project.id, key))
        .setLabel("Bloquear")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(keyButtonId("pause", project.id, key))
        .setLabel("Pausar")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(keyButtonId("enable", project.id, key))
        .setLabel("Activar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(keyButtonId("release", project.id, key))
        .setLabel("Liberar")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(keyButtonId("delete", project.id, key))
        .setLabel("Eliminar")
        .setStyle(ButtonStyle.Danger)
    )
  );
}

function keyButtonId(action, projectId, key) {
  return `key:${action}:${projectId}:${encodeURIComponent(normalizeKey(key))}`;
}

function parseKeyButtonId(customId) {
  const parts = String(customId || "").split(":");
  if (parts.length !== 4 || parts[0] !== "key") return null;
  return {
    action: parts[1],
    projectId: parts[2],
    key: decodeURIComponent(parts[3]),
  };
}

function hiddenKey(key) {
  return `||\`${normalizeKey(key)}\`||`;
}

function escapeMarkdown(value) {
  return value.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
}

function normalizeKey(value) {
  return String(value || "").trim().toUpperCase();
}

function searchableLicense(row) {
  return [
    row.license_key,
    row.status,
    row.label,
    row.device_id,
    row.device_model,
    row.ios_version,
    row.app_version,
    row.activation_ip,
    row.last_ip,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatLicenseLine(row) {
  const label = row.label ? `\nCliente: **${escapeMarkdown(String(row.label))}**` : "";
  const device = row.device_id ? `\nDispositivo: ${row.device_model || "sin modelo"} | ${row.device_id}` : "";
  const ip = row.last_ip || row.activation_ip ? `\nIP: ${row.last_ip || row.activation_ip}` : "";
  const expires = row.expires_at ? `\nVence: ${new Date(row.expires_at).toLocaleString("es-DO")}` : "";
  return `${hiddenKey(row.license_key)} - **${statusLabel(row.status)}**${label}${device}${ip}${expires}`;
}

function statusLabel(status) {
  switch (status) {
    case "active": return "activada";
    case "blocked": return "bloqueada";
    case "paused": return "pausada";
    case "expired": return "expirada";
    default: return "disponible";
  }
}

function codeBlock(value) {
  return `\`\`\`\n${value}\n\`\`\``;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en .env`);
  return value;
}

function cleanError(error) {
  if (!error) return "error desconocido";
  if (typeof error === "string") return error;
  return error.message || JSON.stringify(error);
}
