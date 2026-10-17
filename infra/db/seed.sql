-- Dados fictícios para demonstração, não são ocorrências reais.
WITH sample(category,description,lng,lat,amount) AS (
  VALUES
    ('lixo','EXEMPLO FICTÍCIO: descarte irregular de resíduos.', -46.6259,-23.5506, 14),
    ('esgoto','EXEMPLO FICTÍCIO: possível vazamento de esgoto.', -46.6488,-23.5630, 6),
    ('agua','EXEMPLO FICTÍCIO: alteração na coloração da água.', -46.6678,-23.5732, 23),
    ('queimada','EXEMPLO FICTÍCIO: fumaça e queima de resíduos.', -46.6061,-23.5762, 3),
    ('desmatamento','EXEMPLO FICTÍCIO: supressão de vegetação.', -46.6802,-23.5355, 11),
    ('ar','EXEMPLO FICTÍCIO: odor forte recorrente.', -46.5985,-23.5402, 2),
    ('lixo','EXEMPLO FICTÍCIO: acúmulo de entulho.', -46.6404,-23.5250, 8)
), created AS (
  INSERT INTO issues(category,description,location,report_count,verification_status)
  SELECT category,description,ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography,amount,
         CASE WHEN amount >= 3 THEN 'corroborated' ELSE 'unverified' END
  FROM sample
  RETURNING id,description
)
INSERT INTO reports(issue_id,ip_hash,kind,description)
SELECT id,repeat('0',64),'initial',description FROM created;
