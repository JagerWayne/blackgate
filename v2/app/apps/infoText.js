import { t as tl } from '../../game/data/language.js';
// The text of the Info app: how to play and what every window does. Plain data: a topic is a group, an id, a
// title and a body of small HTML helpers, so the manual can be edited without touching the app that shows it.
// Keep it true to the game: when a rule changes, change it here too (README.md has the long form).

const h = (t) => `<h4 class="mb-1 mt-5 text-[11px] font-bold tracking-widest text-accent">${t}</h4>`;
const p = (t) => `<p class="mb-2 leading-relaxed">${t}</p>`;
const ul = (...items) => `<ul class="mb-2 list-disc space-y-1 pl-5 leading-relaxed">${items.map((i) => tl('apps.infoText.li_li', i)).join('')}</ul>`;
const ol = (...items) => `<ol class="mb-2 list-decimal space-y-1 pl-5 leading-relaxed">${items.map((i) => tl('apps.infoText.li_li', i)).join('')}</ol>`;
const k = (t) => `<kbd class="rounded border border-line bg-panel2 px-1.5 py-0.5 text-[11px] text-white">${t}</kbd>`;
const b = (t) => `<b class="text-white">${t}</b>`;
const tip = (t) => `<div class="my-3 rounded border-l-2 border-accent bg-accent/10 px-3 py-2 leading-relaxed">${t}</div>`;
const warn = (t) => `<div class="my-3 rounded border-l-2 border-danger bg-danger/10 px-3 py-2 leading-relaxed">${t}</div>`;
const table = (head, rows) => `<div class="mb-3 overflow-x-auto"><table class="w-full border-collapse text-left"><thead><tr>${head.map((c) => `<th class="border-b border-line px-2 py-1 text-[10px] tracking-widest text-dim">${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => tl('apps.infoText.tr_tr', r.map((c, i) => `<td class="border-b border-line/40 px-2 py-1 align-top ${i === 0 ? 'text-white' : ''}">${c}</td>`).join(''))).join('')}</tbody></table></div>`;

/// group, id, title, body. The order here is the order of the list.
export const TOPICS = [
  // ---------------------------------------------------------------- the basics
  [tl('apps.infoText.start_here'), 'welcome', tl('apps.infoText.welcome_to_blackgate'), [
    p(tl('apps.infoText.you_are_a_on', b('freelance operator'))),
    p(tl('apps.infoText.every_action_leaves_a', b('traces'), b('heat'))),
    h(tl('apps.infoText.the_loop')),
    ol(
      tl('apps.infoText.on_dsnet_in_internet', b('Take a job')),
      tl('apps.infoText.on_the_nexus_map', b('Find the target')),
      tl('apps.infoText.link_then_open_its', b('Connect')),
      tl('apps.infoText.delete_or_scrub_the', b('Clean up')),
      tl('apps.infoText.in_my_jobs_on', b('Submit the work')),
      tl('apps.infoText.your_machine_device_manager', b('Upgrade')),
    ),
    tip(tl('apps.infoText.new_here_follow_the', b('Tutorial card'))),
    p(tl('apps.infoText.use_the_list_on')),
  ]],

  [tl('apps.infoText.start_here'), 'start', tl('apps.infoText.starting_a_run'), [
    h(tl('apps.infoText.boot_and_login')),
    p(tl('apps.infoText.the_machine_boots_and', b('four profiles'), b('NEW SESSION'))),
    ul(
      tl('apps.infoText.a_profile_has_one'),
      tl('apps.infoText.with_four_profiles_in', b('DELETE SAVE')),
      tl('apps.infoText.the_switch_starts_today', b('Daily')),
    ),
    h(tl('apps.infoText.your_world_is_made')),
    p(tl('apps.infoText.a_new_profile_gets', b('40 companies'), b('2,000 citizens'))),
    h('SAVING'),
    p(tl('apps.infoText.the_game_saves_by', b('SAVE NOW'), b('SAVE + QUIT'), b('Log off'))),
    h(tl('apps.infoText.the_start_menu')),
    p(tl('apps.infoText.the_start_button_bottom', b('Save game'), b('Log off'), k('Esc'))),
  ]],

  [tl('apps.infoText.start_here'), 'tutorial', tl('apps.infoText.the_tutorial'), [
    p(tl('apps.infoText.a_new_run_starts', b('empty gateway'), b('Tutorial card'))),
    h(tl('apps.infoText.part_1_equip')),
    p(tl('apps.infoText.open_the_and_install', b('App Store'))),
    ul(
      tl('apps.infoText.exfil_copies_files_off', b('File Downloader')),
      tl('apps.infoText.wipes_the_logs_your', b('Log Wiper')),
      tl('apps.infoText.shred_deletes_files_on', b('File Shredder')),
      tl('apps.infoText.cracker_opens_locked_services', b('Password Breaker')),
    ),
    p(tl('apps.infoText.you_finish_this_part')),
    h(tl('apps.infoText.part_2_five_lessons')),
    p(tl('apps.infoText.they_run_on_one', b('practice server'))),
    table(['Lesson', tl('apps.infoText.you_do'), 'Reward'], [
      ['1', tl('apps.infoText.install_the_necessary_software'), tl('apps.infoText.the_four_tools')],
      ['2', tl('apps.infoText.copy_a_file_from'), '+600 cr'],
      ['3', tl('apps.infoText.delete_a_file_on'), '+700 cr'],
      ['4', tl('apps.infoText.delete_the_server_s'), '+500 cr'],
      ['5', tl('apps.infoText.delete_a_file_from'), '+300 cr'],
    ]),
    h(tl('apps.infoText.the_card')),
    p(tl('apps.infoText.the_card_has_a', b('tuck'), b('other side'), b('follow'))),
    tip(tl('apps.infoText.running_costs_start_once')),
  ]],

  [tl('apps.infoText.start_here'), 'desk', tl('apps.infoText.the_desktop_and_the'), [
    h(tl('apps.infoText.the_screen')),
    ul(
      tl('apps.infoText.your_handle_and_rank', b('BL@CKG@TE (top right)')),
      tl('apps.infoText.one_icon_per_application', b('Desktop')),
      tl('apps.infoText.the_start_button_and', b('Taskbar (bottom)')),
    ),
    h(tl('apps.infoText.working_with_windows')),
    ul(
      tl('apps.infoText.drag_a_window_by', b('title bar'), b('10 pixels')),
      tl('apps.infoText.drag_the_to_resize', b('edges and corners')),
      tl('apps.infoText.the_title_bar_buttons', b('minimise'), b('maximise / restore'), b('close')),
      tl('apps.infoText.clicking_anywhere_in_a'),
      tl('apps.infoText.hover_almost_anything_for', b('tooltip')),
    ),
    h(tl('apps.infoText.the_header_buttons')),
    table(['Button', 'Does'], [
      ['1x / 2x / 4x / 8x / 16x', tl('apps.infoText.cycles_the_world_clock')],
      ['pause', tl('apps.infoText.stops_or_restarts_the')],
      ['ACTIVE n', tl('apps.infoText.opens_my_jobs_the')],
    ]),
  ]],

  [tl('apps.infoText.start_here'), 'keys', tl('apps.infoText.keyboard_and_mouse'), [
    table(['Input', 'Action'], [
      [k('&#96;') + ' (backtick)', tl('apps.infoText.open_the_command_prompt')],
      [k('Space'), tl('apps.infoText.pause_or_resume_the')],
      [k('Esc'), tl('apps.infoText.leave_a_text_field')],
      [k('Tab') + ' / ' + k(tl('apps.infoText.shift_tab')), tl('apps.infoText.move_between_text_fields')],
      [k('Enter'), tl('apps.infoText.press_the_highlighted_button')],
      [k('F11'), tl('apps.infoText.full_screen_on_and')],
      [k('Alt+F4'), tl('apps.infoText.quit_the_windows_app')],
      [tl('apps.infoText.any_key'), tl('apps.infoText.turn_the_machine_back')],
    ]),
    p(tl('apps.infoText.the_backtick_and_space', b('not typing'))),
    h(tl('apps.infoText.on_the_nexus_map_2')),
    table(['Input', 'Action'], [
      [tl('apps.infoText.mouse_wheel'), tl('apps.infoText.zoom_in_and_out')],
      ['Drag', tl('apps.infoText.pan_the_map')],
      [tl('apps.infoText.hover_a_city'), tl('apps.infoText.highlights_it_and_the')],
      [tl('apps.infoText.click_a_city'), tl('apps.infoText.selects_its_first_machine')],
      [tl('apps.infoText.hover_click_a_pin'), tl('apps.infoText.shows_selects_that_machine')],
      [tl('apps.infoText.pick_a_machine_in'), tl('apps.infoText.the_map_glides_to')],
    ]),
    h(tl('apps.infoText.in_notepad')),
    p(tl('apps.infoText.the_arrow_keys_and', k('Home'), k('End'))),
    h(tl('apps.infoText.sound_and_effects')),
    p(tl('apps.infoText.events_have_sounds_a', b('sound'), b('screen effects'))),
  ]],

  // ---------------------------------------------------------------- finding work
  [tl('apps.infoText.the_job'), 'jobs', tl('apps.infoText.jobs_what_you_are'), [
    p(tl('apps.infoText.jobs_come_from_clients')),
    table([tl('apps.infoText.kind_market_name'), tl('apps.infoText.the_job_2')], [
      [tl('apps.infoText.data_heists_retrieve'), tl('apps.infoText.copy_a_file_off')],
      [tl('apps.infoText.scrubbers_delete'), tl('apps.infoText.erase_one_file_from')],
      [tl('apps.infoText.burn_book_destroy'), tl('apps.infoText.wipe_the_host_every')],
      [tl('apps.infoText.paperwork_alteration'), tl('apps.infoText.rewrite_one_detail_in')],
      [tl('apps.infoText.money_moves_transfer'), tl('apps.infoText.move_funds_out_of')],
      [tl('apps.infoText.mind_theft_model'), tl('apps.infoText.steal_a_trained_ai')],
      ['Story', tl('apps.infoText.missions_that_are_part')],
    ]),
    h(tl('apps.infoText.fees_deadlines_and_the')),
    ul(
      tl('apps.infoText.a_job_pays_its'),
      tl('apps.infoText.the_board_keeps_6'),
      tl('apps.infoText.harder_hosts_only_appear'),
      tl('apps.infoText.miss_a_deadline_and'),
    ),
    h(tl('apps.infoText.where_jobs_live')),
    ul(
      tl('apps.infoText.in_internet_xplorer_is', b('DSNET')),
      tl('apps.infoText.sometimes_carries_a_job', b('Outlook')),
      tl('apps.infoText.in_the_header_opens', b('ACTIVE n')),
    ),
    h(tl('apps.infoText.getting_paid')),
    p(tl('apps.infoText.when_the_objective_is', b('ready'), b('SUBMIT WORK'))),
  ]],

  [tl('apps.infoText.the_job'), 'dsn', tl('apps.infoText.internet_xplorer_and_dsnet'), [
    p(tl('apps.infoText.internet_xplorer_is_the', b('six tabs'))),
    p(tl('apps.infoText.the_address_bar_opens', b('start page'))),
    h(tl('apps.infoText.the_sites')),
    table(['Site', 'Address', tl('apps.infoText.what_it_is')], [
      ['DSNET', tl('apps.infoText.dsnet_dsn_hub'), tl('apps.infoText.the_hidden_job_market')],
      ['SleekPages', 'sleekpages', tl('apps.infoText.the_social_network_faces')],
      [tl('apps.infoText.business_directory'), 'directory', tl('apps.infoText.every_company_s_website')],
      [tl('apps.infoText.whois_nx'), tl('apps.infoText.whois_nx'), tl('apps.infoText.the_domain_registry_type')],
      ['eForest', tl('apps.infoText.eforest_nx'), tl('apps.infoText.the_hardware_store_see')],
    ]),
    h(tl('apps.infoText.dsnet_pages')),
    table(['Address', 'Page'], [
      [tl('apps.infoText.dsn_hub'), tl('apps.infoText.the_portal_search_the')],
      [tl('apps.infoText.dsn_cat_lt_kind'), tl('apps.infoText.data_heists_scrubbers_paperwork')],
      [tl('apps.infoText.dsn_lt_broker_gt'), tl('apps.infoText.a_client_s_own')],
      [tl('apps.infoText.dsn_job_lt_id'), tl('apps.infoText.a_listing_brief_and')],
      [tl('apps.infoText.dsn_jobs'), tl('apps.infoText.my_jobs_submit_link')],
      [tl('apps.infoText.dsn_lookup_lt_company'), tl('apps.infoText.leakbase_what_is_known')],
      [tl('apps.infoText.dsn_board'), tl('apps.infoText.the_undernet_board_rumours')],
    ]),
    p(tl('apps.infoText.on_dsnet_pages_a', b('rail'), b('highest fee'), b('time left'), b('easiest'))),
    h('HAGGLING'),
    p(tl('apps.infoText.on_a_listing_you')),
    ul(
      tl('apps.infoText.the_fee_rises_to', b('Yes')),
      tl('apps.infoText.halfway_between_the_posted', b('Counter-offer'), b('TAKE'), b('COUNTER')),
      tl('apps.infoText.the_posted_fee_stands', b('No')),
      tl('apps.infoText.ask_for_more_than', b('Insulted')),
    ),
    p(tl('apps.infoText.the_chance_of_a', b('DECLINE THE JOB'))),
    h('SLEEKPAGES'),
    ul(
      tl('apps.infoText.posts_from_random_people', b('Feed')),
      tl('apps.infoText.search_everyone_by_name', b('People')),
      tl('apps.infoText.portrait_job_an_about', b('Profile'), b('VIEW DOSSIER')),
    ),
    h(tl('apps.infoText.company_websites')),
    p(tl('apps.infoText.each_of_the_40')),
  ]],

  // ---------------------------------------------------------------- the hacking
  [tl('apps.infoText.the_hack'), 'blackgate', tl('apps.infoText.bl_ckg_te_the'), [
    p(tl('apps.infoText.bl_ckg_te_has', b('Nexus Map'), b('Live Link'), b('Company Map'), b('Dossiers'))),
    h(tl('apps.infoText.nexus_map')),
    p(tl('apps.infoText.the_world_map_with', b('KIND'))),
    ul(
      tl('apps.infoText.the_list_with_and', b('HOSTS'), b('+HOP'), b('-HOP'), b('LINK')),
      tl('apps.infoText.your_hops_as_a', b('ROUTE')),
      tl('apps.infoText.routes_you_kept_with', b('SAVED')),
    ),
    p(tl('apps.infoText.and_anywhere_in_the', b('SHOW TARGET'), b('SHOW ON MAP'))),
    h(tl('apps.infoText.planning_a_route')),
    p(tl('apps.infoText.add_relay_hops_to')),
    h('LINK'),
    p(tl('apps.infoText.press_to_connect_through', b('LINK'))),
    h(tl('apps.infoText.internal_hosts')),
    p(tl('apps.infoText.the_last_host_of', b('internal segment'))),
  ]],

  [tl('apps.infoText.the_hack'), 'link', tl('apps.infoText.the_live_link'), [
    p(tl('apps.infoText.with_a_link_open', b('ACCESS'), b('STORAGE'), b('RECORDS'), b('PEOPLE'), b('CLI'))),
    h(tl('apps.infoText.right_click_is_the')),
    p(tl('apps.infoText.the_link_has_no', b('right click'))),
    ul(
      tl('apps.infoText.a_copy_to_my', b('file')),
      tl('apps.infoText.a_crack_the_password', b('locked service')),
      tl('apps.infoText.a_delete_all_logs', b('log')),
      tl('apps.infoText.the_in_the_header', b('host name')),
    ),
    p(tl('apps.infoText.only_the_apps_you')),
    h(tl('apps.infoText.the_tabs')),
    table(['Tab', 'Shows'], [
      ['ACCESS', tl('apps.infoText.the_services_and_their')],
      ['STORAGE', tl('apps.infoText.a_small_file_explorer')],
      ['RECORDS', tl('apps.infoText.the_people_whose_details')],
      ['PEOPLE', tl('apps.infoText.the_company_s_staff')],
      ['CLI', tl('apps.infoText.a_shell_over_the')],
    ]),
    h(tl('apps.infoText.the_bypasses')),
    table(['Defence', tl('apps.infoText.what_it_does'), tl('apps.infoText.what_beats_it')], [
      [tl('apps.infoText.firewall_fw_1_5'), tl('apps.infoText.stops_you_reaching_the'), tl('apps.infoText.firewall_breaker_of_the')],
      ['Monitor (1-5)', tl('apps.infoText.raises_the_alarm_when'), tl('apps.infoText.alarm_silencer_of_the')],
      [tl('apps.infoText.proxy_px_1_5'), tl('apps.infoText.hides_the_real_host'), tl('apps.infoText.relay_cleaner_of_the')],
    ]),
    p(tl('apps.infoText.the_overload_attack_drops', b('DDoS cannon'))),
    h('LOCKS'),
    ul(
      tl('apps.infoText.are_opened_by_the', b('Password locks')),
      tl('apps.infoText.from_difficulty_4_a', b('MFA'), b('hijacks'), b('40 seconds')),
      tl('apps.infoText.want_the_security_key', b('Hardware tokens')),
      tl('apps.infoText.open_to_their_admin', b('Voice locks')),
      tl('apps.infoText.need_the_file_unlocker', b('Encrypted files')),
    ),
    h(tl('apps.infoText.thread_slots_and_tasks')),
    p(tl('apps.infoText.every_running_task_takes', b('thread slot'))),
    h(tl('apps.infoText.copying_and_the_window')),
    p(tl('apps.infoText.a_copy_takes_the')),
    h(tl('apps.infoText.the_cli_tab')),
    p(tl('apps.infoText.a_shell_over_the_2')),
  ]],

  [tl('apps.infoText.the_hack'), 'logs', tl('apps.infoText.the_trace_logs_and'), [
    h(tl('apps.infoText.the_trace')),
    p(tl('apps.infoText.while_you_are_connected', b('the run is over'))),
    ul(
      tl('apps.infoText.past_two_thirds_the'),
      tl('apps.infoText.a_link_that_keeps'),
      tl('apps.infoText.drops_every_task_and', b('BURN LINE')),
      tl('apps.infoText.disconnecting_with_the_trace', b('70% or more')),
      tl('apps.infoText.hard_hosts_carry_a'),
    ),
    warn(tl('apps.infoText.the_rented_overseas_server', b('wipes every file on your drives'))),
    h('LOGS'),
    p(tl('apps.infoText.every_link_writes_a', b('session open'), b('Wipe'), b('scrub'))),
    p(tl('apps.infoText.logs_you_leave_behind', b('heat'))),
    h('HEAT'),
    p(tl('apps.infoText.heat_runs_from_0', b('CLEAR'), b('RECON'), b('BREACH'))),
    h('RAIDS'),
    p(tl('apps.infoText.at_heat_100_you', b('Intruder Alarm Sensors'))),
    ul(
      tl('apps.infoText.the_adds_45_seconds', b('Radio Jammer')),
      tl('apps.infoText.the_burns_the_rig', b('Self-Destruct Charge')),
      tl('apps.infoText.the_can_drive_to', b('Mobile Hideout Van')),
      tl('apps.infoText.the_micro_pc_has'),
    ),
    h('PERKS'),
    p(tl('apps.infoText.every_3_finished_jobs', b('perk'))),
  ]],

  [tl('apps.infoText.the_hack'), 'osint', tl('apps.infoText.people_and_osint'), [
    p(tl('apps.infoText.every_world_has_about', b('2,000 people'))),
    h(tl('apps.infoText.public_and_private')),
    p(tl('apps.infoText.each_person_shows_some', b('click it and it goes into the dossier'))),
    h(tl('apps.infoText.finding_people')),
    p(tl('apps.infoText.an_osint_sweep_on', b('PROFILE'))),
    table([tl('apps.infoText.people_finder'), tl('apps.infoText.profile_finds')], [['v1', tl('apps.infoText.email_and_role')], ['v2', '+ phone'], ['v3', tl('apps.infoText.social_handle')], ['v4+', tl('apps.infoText.leaked_password')]]),
    h(tl('apps.infoText.working_on_people')),
    p(tl('apps.infoText.attacks_run_as_tasks')),
    table(['Attack', 'Needs', tl('apps.infoText.gets_you')], [
      [tl('apps.infoText.call_record'), tl('apps.infoText.phone_voice_copier'), tl('apps.infoText.a_voice_recording_for')],
      [tl('apps.infoText.spoofed_call'), tl('apps.infoText.phone_fake_identity_kit'), tl('apps.infoText.the_same_recording_posing')],
      [tl('apps.infoText.tap_phone'), tl('apps.infoText.phone_fake_identity_kit_2'), tl('apps.infoText.a_password_they_read')],
      [tl('apps.infoText.hack_inbox'), tl('apps.infoText.email_leaked_password_email'), tl('apps.infoText.their_mail_every_host')],
      ['PHISH', tl('apps.infoText.email_fake_identity_kit'), tl('apps.infoText.a_fake_reset_mail')],
      ['SPAM', tl('apps.infoText.email_fake_identity_kit'), tl('apps.infoText.their_inbox_buried_for')],
    ]),
    h(tl('apps.infoText.records_and_alterations')),
    p(tl('apps.infoText.each_detail_of_a')),
    h('DOSSIERS'),
    p(tl('apps.infoText.the_dossiers_tab_of')),
  ]],

  // ---------------------------------------------------------------- the machine
  [tl('apps.infoText.your_machine'), 'gateway', tl('apps.infoText.device_manager'), [
    p(tl('apps.infoText.your_gateway_is_built', b('case'), b('motherboard'), b('parts'))),
    p(tl('apps.infoText.the_top_shows_the')),
    ul(
      tl('apps.infoText.the_spec_card_and', b('SLOT')),
      tl('apps.infoText.your_spare_parts_filtered', b('STOCK')),
      tl('apps.infoText.build_a_second_machine', b('BUILD')),
    ),
    p(tl('apps.infoText.the_device_manager_sells', b('BUY ON eFOREST'))),
    h('CASES'),
    table(['Case', 'Price', 'Size', 'Bays', 'Security'], [
      [tl('apps.infoText.micro_pc'), 'free', tl('apps.infoText.micro_pc_2'), '2', '0'], [tl('apps.infoText.rented_overseas_server'), '6,500', tl('apps.infoText.mini_itx'), '2', '0'], [tl('apps.infoText.hidden_mini_server'), '14,000', tl('apps.infoText.micro_atx'), '3', '1'],
      [tl('apps.infoText.soundproof_server_rack'), '32,000', 'ATX', '4', '2'], [tl('apps.infoText.big_storage_rack'), '48,000', 'E-ATX', '8', '2'], [tl('apps.infoText.super_computer_cluster'), '75,000', tl('apps.infoText.server_rack'), '8', '2'], [tl('apps.infoText.mobile_hideout_van'), '120,000', tl('apps.infoText.server_rack'), '8', '3'],
    ]),
    p(tl('apps.infoText.a_case_takes_a')),
    h('MOTHERBOARDS'),
    table(['Board', 'Price', tl('apps.infoText.cpu_sockets_best_tier'), tl('apps.infoText.drive_bays'), 'Net'], [
      [tl('apps.infoText.built_in_micro_board'), tl('apps.infoText.built_in'), '1 (T1)', '2 (64 GB)', '1'], [tl('apps.infoText.mini_itx_board'), '1,800', '1 (T2)', '2 (512 GB)', '1'], [tl('apps.infoText.micro_atx_board'), '4,500', '2 (T2)', '3 (1 TB)', '1'],
      [tl('apps.infoText.atx_board'), '9,500', '2 (T3)', '4 (2 TB)', '1'], [tl('apps.infoText.e_atx_workstation_board'), '21,000', '4 (T4)', '6 (4 TB)', '1'], [tl('apps.infoText.server_rack_board'), '52,000', '8 (T5)', '8 (12 TB)', '2'],
    ]),
    h('PARTS'),
    ul(
      tl('apps.infoText.each_socket_gives_thread', b('Compute')),
      tl('apps.infoText.booster_cards_x1_to', b('Accelerator')),
      tl('apps.infoText.the_unlock_speed_chip', b('FPGA')),
      tl('apps.infoText.the_security_key_reader', b('HSM')),
      tl('apps.infoText.seven_kinds_of_drive', b('Storage')),
      tl('apps.infoText.download_speed_and_how', b('Modem')),
      tl('apps.infoText.intruder_alarm_sensors_self', b('Security')),
    ),
    h(tl('apps.infoText.drives_sys_and_str')),
    ul(
      tl('apps.infoText.bay_1_is_the', b('SYS Drive (C:)'), b('STR Drives (D:)')),
      tl('apps.infoText.a_hard_disk_as'),
      tl('apps.infoText.any_change_that_would'),
      tl('apps.infoText.the_machine_always_keeps'),
    ),
    h(tl('apps.infoText.building_a_new_system')),
    p(tl('apps.infoText.the_build_tab_makes', b('only from items you already own'))),
    p(tl('apps.infoText.parts_taken_out_go')),
  ]],

  [tl('apps.infoText.your_machine'), 'eforest', tl('apps.infoText.eforest_the_hardware_store'), [
    p(tl('apps.infoText.open_it_in_internet', b('BUY ON eFOREST'))),
    ul(
      tl('apps.infoText.browse_by_search_sort', b('department'), b('cart')),
      tl('apps.infoText.a_daily_deal_takes'),
      tl('apps.infoText.each_part_shows_whether', b('fits your machine')),
    ),
    h('DELIVERY'),
    table(['Delivery', 'Fee', 'Time'], [['Economy', 'free', '3 days'], ['Standard', tl('apps.infoText.3_at_least_10'), '2 days'], [tl('apps.infoText.next_day'), tl('apps.infoText.8_at_least_30'), '1 day']]),
    p(tl('apps.infoText.cases_and_boards_double', b('Fitting takes the machine offline'))),
  ]],

  [tl('apps.infoText.your_machine'), 'software', tl('apps.infoText.app_store_and_the'), [
    p(tl('apps.infoText.the_app_store_sells', b('ALL / INSTALLED / SHOP'), b('BUY / UPGRADE'))),
    tip(tl('apps.infoText.the_shop_only_sells')),
    h('SIZE'),
    p(tl('apps.infoText.every_tool_takes_room')),
    h(tl('apps.infoText.the_tools')),
    table([tl('apps.infoText.tool_code_versions'), tl('apps.infoText.what_it_does')], [
      [tl('apps.infoText.password_breaker_cracker_v1'), tl('apps.infoText.opens_password_locks_up')],
      [tl('apps.infoText.two_step_login_bypass'), tl('apps.infoText.hijacks_a_live_session')],
      [tl('apps.infoText.relay_cleaner_pivot_v1'), tl('apps.infoText.scrubs_proxies_up_to')],
      [tl('apps.infoText.firewall_breaker_waf_v1'), tl('apps.infoText.gets_past_firewalls_up')],
      [tl('apps.infoText.alarm_silencer_edr_v1'), tl('apps.infoText.blinds_monitors_up_to')],
      [tl('apps.infoText.overload_attack_ddos_v1'), tl('apps.infoText.drops_firewalls_and_proxies')],
      [tl('apps.infoText.trace_alert_soc_v1'), tl('apps.infoText.warns_of_a_trace')],
      [tl('apps.infoText.file_downloader_exfil'), tl('apps.infoText.copies_files_from_a')],
      [tl('apps.infoText.file_shredder_shred'), tl('apps.infoText.deletes_files_on_a')],
      [tl('apps.infoText.file_unlocker_ransom_v1'), tl('apps.infoText.decrypts_files_encrypted_up')],
      [tl('apps.infoText.record_forger_fabricate'), tl('apps.infoText.changes_a_person_s')],
      [tl('apps.infoText.quiet_log_cleaner_stomper'), tl('apps.infoText.scrubs_only_your_own')],
      [tl('apps.infoText.log_wiper'), tl('apps.infoText.wipes_all_the_logs')],
      [tl('apps.infoText.people_finder_crawler_v1'), tl('apps.infoText.profile_finds_email_and')],
      [tl('apps.infoText.email_login_tester_stuffer'), tl('apps.infoText.opens_an_inbox_with')],
      [tl('apps.infoText.voice_copier_cloner'), tl('apps.infoText.records_voices_and_matches')],
      [tl('apps.infoText.fake_identity_kit_spoof'), tl('apps.infoText.spoofed_calls_phishing_spam')],
      [tl('apps.infoText.network_mapper_mapper_v1'), tl('apps.infoText.maps_a_company_s')],
      [tl('apps.infoText.key_finder_iam_v1'), tl('apps.infoText.opens_a_locked_service')],
      [tl('apps.infoText.staff_pass_forger_kerb'), tl('apps.infoText.moves_the_live_link')],
      [tl('apps.infoText.admin_takeover_privesc_v1'), tl('apps.infoText.roots_the_host_and')],
      [tl('apps.infoText.target_overview_surface'), tl('apps.infoText.hud_the_target_s')],
      [tl('apps.infoText.route_viewer_hops'), tl('apps.infoText.hud_draws_your_route')],
      [tl('apps.infoText.company_map_graph'), tl('apps.infoText.hud_opens_the_company')],
    ]),
    p(tl('apps.infoText.a_target_needs_a')),
  ]],

  [tl('apps.infoText.your_machine'), 'files', tl('apps.infoText.my_computer'), [
    p(tl('apps.infoText.your_gateway_s_drive')),
    ul(
      tl('apps.infoText.the_installed_software_which', b('apps')),
      tl('apps.infoText.the_files_you_copied', b('downloads')),
      tl('apps.infoText.your_own_log_one', b('logs'), b('OPEN IN NOTEPAD')),
    ),
    p(tl('apps.infoText.the_logs_of_a')),
  ]],

  [tl('apps.infoText.your_machine'), 'money', 'Money', [
    p(tl('apps.infoText.four_tabs_and', b('ACCOUNT'), b('SAVINGS'), b('LOANS'), b('WALLET'))),
    ul(
      tl('apps.infoText.your_balance_and_the', b('Account')),
      tl('apps.infoText.move_credits_in_and', b('Savings')),
      tl('apps.infoText.one_loan_at_a', b('Loans')),
      tl('apps.infoText.three_coins_to_trade', b('Wallet')),
    ),
    h(tl('apps.infoText.the_economy')),
    p(tl('apps.infoText.the_game_is_tuned', b('arrears'))),
  ]],

  [tl('apps.infoText.your_machine'), 'mail', 'Outlook', [
    p(tl('apps.infoText.two_tabs_and', b('Inbox'), b('News'))),
    ul(
      tl('apps.infoText.messages_from_the_broker', b('Inbox'), b('MARK ALL READ')),
      tl('apps.infoText.the_newswire_including_stories', b('News')),
    ),
  ]],

  // ---------------------------------------------------------------- tools
  ['TOOLS', 'operator', tl('apps.infoText.control_panel'), [
    p(tl('apps.infoText.two_tabs')),
    ul(
      tl('apps.infoText.your_handle_rank_and', b('Profile')),
      tl('apps.infoText.every_45_seconds_and', b('Settings'), b('screen effects'), b('sound'), b('autosave'), b('open every link on the CLI tab'), b('8x fast-forward')),
    ),
    p(tl('apps.infoText.your_rating_rises_as')),
  ]],

  ['TOOLS', 'notepad', 'Notepad', [
    p(tl('apps.infoText.notes_kept_with_your', b('12 notepads'), b('+ NEW'), b('x'))),
    p(tl('apps.infoText.use_it_for_passwords')),
  ]],

  ['TOOLS', 'terminal', tl('apps.infoText.command_prompt'), [
    p(tl('apps.infoText.open_it_from_the', k('&#96;'))),
    ul(
      tl('apps.infoText.after_a_list_code'),
      tl('apps.infoText.put_text_with_spaces'),
      tl('apps.infoText.runs_the_line_completes', k('Enter'), k('Tab'), k('Up'), k('Down'), k('Esc')),
      tl('apps.infoText.commands_that_take_a'),
      tl('apps.infoText.typing_an_app_s'),
    ),
    h('GENERAL'),
    table(['Command', 'Does'], [
      [tl('apps.infoText.help_app'), tl('apps.infoText.the_apps_or_one')], ['apps', tl('apps.infoText.the_applications_and_which')], [tl('apps.infoText.open_lt_app_gt'), tl('apps.infoText.open_or_close_a')],
      ['clear', tl('apps.infoText.clear_the_screen')], ['history', tl('apps.infoText.commands_typed_this_session')], ['whoami', tl('apps.infoText.handle_rank_rating_money')], ['time', tl('apps.infoText.game_time_clock_speed')],
      [tl('apps.infoText.pause_resume'), tl('apps.infoText.stop_or_start_the')], ['save', tl('apps.infoText.save_now')], ['exit', tl('apps.infoText.close_the_prompt')],
    ]),
    h(tl('apps.infoText.mail_and_jobs')),
    table(['Command', 'Does'], [
      [tl('apps.infoText.mail_list_new_all'), tl('apps.infoText.the_messages_newest_first')], [tl('apps.infoText.mail_read_lt_new'), tl('apps.infoText.show_a_message_and')], [tl('apps.infoText.mail_readall'), tl('apps.infoText.mark_all_read')],
      [tl('apps.infoText.mail_accept_decline_lt'), tl('apps.infoText.answer_the_job_a')], [tl('apps.infoText.mail_target_lt_gt'), tl('apps.infoText.show_the_offered_job')],
      [tl('apps.infoText.ct_list_offered_accepted'), tl('apps.infoText.jobs_with_id_kind')], [tl('apps.infoText.ct_show_lt_id'), tl('apps.infoText.the_full_brief_and')], [tl('apps.infoText.ct_accept_decline_drop'), tl('apps.infoText.take_turn_down_or')],
      [tl('apps.infoText.ct_target_lt_id'), tl('apps.infoText.reveal_the_target_on')], [tl('apps.infoText.ct_submit_lt_id'), tl('apps.infoText.hand_in_finished_work')],
    ]),
    h(tl('apps.infoText.map_and_link')),
    table(['Command', 'Does'], [
      [tl('apps.infoText.map_hosts_kind_text'), tl('apps.infoText.found_hosts_filtered')], [tl('apps.infoText.map_show_select_fav'), tl('apps.infoText.details_select_favourite_a')], [tl('apps.infoText.map_route'), tl('apps.infoText.show_the_bounce_route')],
      [tl('apps.infoText.map_route_add_remove'), tl('apps.infoText.add_or_remove_a')], [tl('apps.infoText.map_route_clear_save'), tl('apps.infoText.empty_or_keep_the')], [tl('apps.infoText.map_routes_map_route'), tl('apps.infoText.the_saved_routes_use')],
      [tl('apps.infoText.map_link_lt_host'), tl('apps.infoText.connect_through_the_current')],
      [tl('apps.infoText.bg_connect_lt_host'), tl('apps.infoText.open_or_close_the')], [tl('apps.infoText.bg_status'), tl('apps.infoText.heat_the_trace_and')], [tl('apps.infoText.bg_services_bg_files'), tl('apps.infoText.what_the_host_offers')],
      [tl('apps.infoText.bg_logs_wipe_scrub'), tl('apps.infoText.show_wipe_or_quietly')], [tl('apps.infoText.bg_records_text'), tl('apps.infoText.the_people_on_the')], [tl('apps.infoText.bg_crack_service'), tl('apps.infoText.break_a_password')],
      [tl('apps.infoText.bg_record_bg_voiceprint'), tl('apps.infoText.record_a_voice_then')], [tl('apps.infoText.bg_hijack_service'), tl('apps.infoText.capture_a_session_behind')], [tl('apps.infoText.bg_netmap_bg_forge'), tl('apps.infoText.map_the_company_move')],
      [tl('apps.infoText.bg_probe_bg_root'), tl('apps.infoText.open_a_lock_with')], [tl('apps.infoText.bg_bypass_firewall_monitor'), tl('apps.infoText.bypass_a_defence')], [tl('apps.infoText.bg_copy_delete_decrypt'), tl('apps.infoText.file_tasks')],
      [tl('apps.infoText.bg_alter_lt_person'), tl('apps.infoText.change_a_record')], [tl('apps.infoText.bg_osint'), tl('apps.infoText.run_an_osint_sweep')],
    ]),
    h(tl('apps.infoText.machine_money_and_the')),
    table(['Command', 'Does'], [
      [tl('apps.infoText.gw_specs_stock_build'), tl('apps.infoText.fitted_parts_stock_the')], [tl('apps.infoText.gw_remove_lt_slot'), tl('apps.infoText.take_a_part_out')], [tl('apps.infoText.gw_fit_lt_gt'), tl('apps.infoText.fit_or_sell_a')],
      [tl('apps.infoText.gw_migrate_lt_slot'), tl('apps.infoText.move_the_finished_build')], [tl('apps.infoText.gw_relocate'), tl('apps.infoText.drive_the_van_to')],
      [tl('apps.infoText.sw_list_shop_info'), tl('apps.infoText.your_tools_the_shop')], [tl('apps.infoText.sw_buy_lt_tool'), tl('apps.infoText.buy_or_upgrade_a')],
      [tl('apps.infoText.storage_list_space_delete'), tl('apps.infoText.downloads_and_drive_space')], [tl('apps.infoText.bank_balance_ledger_wallet'), tl('apps.infoText.money_transactions_coins')], [tl('apps.infoText.bank_save_withdraw_lt'), tl('apps.infoText.move_credits_to_or')],
      [tl('apps.infoText.bank_loan_lt_n'), tl('apps.infoText.borrow_or_pay_back')], [tl('apps.infoText.bank_buy_sell_lt'), tl('apps.infoText.trade_stbl_blue_ghst')], [tl('apps.infoText.news_list_news_read'), tl('apps.infoText.the_newswire')],
      ['operator', tl('apps.infoText.rating_rank_and_statistics')], [tl('apps.infoText.sys_autosave_fast_on'), tl('apps.infoText.settings_save_log_out')],
      [tl('apps.infoText.dsn_open_address_dsn'), tl('apps.infoText.open_a_page_in')], [tl('apps.infoText.dsn_haggle_lt_job'), tl('apps.infoText.ask_for_a_bigger')], [tl('apps.infoText.dsn_reply_take_lt'), tl('apps.infoText.read_the_answer_take')],
      [tl('apps.infoText.ppl_list_staff_show'), tl('apps.infoText.everyone_on_file_the')], [tl('apps.infoText.ppl_profile_call_spoofcall'), tl('apps.infoText.the_osint_attacks')],
      [tl('apps.infoText.notepad_show_write_wrap'), tl('apps.infoText.the_open_notepad')], [tl('apps.infoText.notepad_list_new_open'), tl('apps.infoText.your_notepads')], [tl('apps.infoText.calc_eval_12_3'), tl('apps.infoText.work_out_a_sum')],
    ]),
  ]],

  ['TOOLS', 'calc', 'Calculator', [
    p(tl('apps.infoText.a_pocket_calculator_click', k('Enter'), k('Backspace'))),
    p(tl('apps.infoText.in_the_command_prompt')),
  ]],

  ['TOOLS', 'cheats', tl('apps.infoText.cheat_menu_and_mission'), [
    p(tl('apps.infoText.click_the_top_left', b('BLACKGATE logo'), b('CHEATS'), b('not'), b('PLAYER'), b('WORLD'), b('SWITCHES'))),
    ul(
      tl('apps.infoText.set_your_money_rating'),
      tl('apps.infoText.pause_and_set_the'),
      `${b(tl('apps.infoText.reveal_the_map'))}, ${b(tl('apps.infoText.every_tool_at_v5'))}, ${b(tl('apps.infoText.max_the_gateway'))}, ${b(tl('apps.infoText.skip_the_tutorial'))}.`,
      tl('apps.infoText.build_a_job_to', b('OPEN MISSION BUILDER')),
    ),
    p(tl('apps.infoText.in_the_command_prompt_2')),
  ]],

  // ---------------------------------------------------------------- reference
  ['REFERENCE', 'rating', tl('apps.infoText.rating_and_unlocks'), [
    p(tl('apps.infoText.your_rating_rises_as_2')),
    table(['Level', tl('apps.infoText.rating_needed')], [['1', '0'], ['2', '6'], ['3', tl('apps.infoText.16_internal_hosts_are')], ['4', '30'], ['5', '48'], ['6', '70'], ['7', '100']]),
    p(tl('apps.infoText.the_world_is_built')),
  ]],

  ['REFERENCE', 'tips', tl('apps.infoText.tips_for_a_long'), [
    ul(
      tl('apps.infoText.a_job_done_with', b('Clean up every time.')),
      tl('apps.infoText.plan_the_route_equip', b('Do not stay linked longer than you must.')),
      tl('apps.infoText.press_space_while_you', b('Pause is free.')),
      tl('apps.infoText.a_good_long_route', b('Save routes you trust.')),
      tl('apps.infoText.a_full_str_drive', b('Buy storage early.')),
      tl('apps.infoText.order_parts_on_eforest', b('Build the next machine before you need it.')),
      tl('apps.infoText.a_refused_ask_costs', b('Haggle on easy jobs.')),
      tl('apps.infoText.at_recon_70_stop', b('Watch the heat band.')),
      tl('apps.infoText.it_is_the_only', b('Buy Target Overview.')),
      tl('apps.infoText.a_good_profile_turns', b('Use dossiers.')),
      tl('apps.infoText.a_bigger_rig_costs', b('Mind the running costs.')),
    ),
    h(tl('apps.infoText.if_something_goes_wrong')),
    ul(
      tl('apps.infoText.a_button_is_greyed'),
      tl('apps.infoText.a_task_is_waiting'),
      tl('apps.infoText.a_copy_will_not'),
      tl('apps.infoText.a_lock_will_not'),
    ),
  ]],

  ['REFERENCE', tl('apps.infoText.files_saves'), tl('apps.infoText.files_saves_and_updates'), [
    p(tl('apps.infoText.in_the_windows_app')),
    table(['Path', tl('apps.infoText.what_it_is')], [
      ['app\\', tl('apps.infoText.the_installed_game_replaced')],
      [tl('apps.infoText.saves_lt_operator_gt'), tl('apps.infoText.one_save_per_profile')],
      [tl('apps.infoText.hosts_lt_operator_gt'), tl('apps.infoText.the_machines_that_operator')],
      [tl('apps.infoText.json_hints_sessionactions'), tl('apps.infoText.your_copy_of_the')],
      [tl('apps.infoText.blackgate_log'), tl('apps.infoText.warnings_for_example_about')],
    ]),
    p(tl('apps.infoText.the_launcher_blackgate_exe', b('Updates.'))),
    p(tl('apps.infoText.the_game_runs_from', b('In a browser'))),
    p(tl('apps.infoText.the_start_menu_s', b('Turning off.'))),
  ]],
];
