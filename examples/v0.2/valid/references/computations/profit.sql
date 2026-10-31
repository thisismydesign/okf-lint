SELECT gross_profit
FROM {{ ref('fct_income_statement') }}
WHERE fiscal_year = {{ var('year') }}
  AND segment = {{ var('segment') }}
