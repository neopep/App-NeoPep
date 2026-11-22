alter table neo_private.agents add constraint release_agents_inactive check (status<>'active');
