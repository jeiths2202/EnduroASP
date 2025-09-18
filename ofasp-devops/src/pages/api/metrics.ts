import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const metrics = `
# HELP ofasp_devops_conversion_total Total number of conversions performed
# TYPE ofasp_devops_conversion_total counter
ofasp_devops_conversion_total{type="cobol_to_java"} 156
ofasp_devops_conversion_total{type="cobol_to_python"} 89
ofasp_devops_conversion_total{type="cobol_to_c"} 34
ofasp_devops_conversion_total{type="cl_to_shell"} 203
ofasp_devops_conversion_total{type="cl_to_javascript"} 67
ofasp_devops_conversion_total{type="cl_to_python"} 45

# HELP ofasp_devops_conversion_duration_seconds Time spent on conversions
# TYPE ofasp_devops_conversion_duration_seconds histogram
ofasp_devops_conversion_duration_seconds_bucket{type="cobol",le="1.0"} 23
ofasp_devops_conversion_duration_seconds_bucket{type="cobol",le="2.5"} 78
ofasp_devops_conversion_duration_seconds_bucket{type="cobol",le="5.0"} 145
ofasp_devops_conversion_duration_seconds_bucket{type="cobol",le="10.0"} 189
ofasp_devops_conversion_duration_seconds_bucket{type="cobol",le="+Inf"} 201
ofasp_devops_conversion_duration_seconds_sum{type="cobol"} 567.8
ofasp_devops_conversion_duration_seconds_count{type="cobol"} 201

# HELP ofasp_devops_pipeline_runs_total Total number of pipeline runs
# TYPE ofasp_devops_pipeline_runs_total counter
ofasp_devops_pipeline_runs_total{status="success"} 387
ofasp_devops_pipeline_runs_total{status="failed"} 23
ofasp_devops_pipeline_runs_total{status="running"} 3

# HELP ofasp_devops_active_conversions Current number of active conversions
# TYPE ofasp_devops_active_conversions gauge
ofasp_devops_active_conversions 5

# HELP ofasp_devops_uptime_seconds Uptime of the service
# TYPE ofasp_devops_uptime_seconds counter
ofasp_devops_uptime_seconds ${process.uptime()}

# HELP nodejs_version_info Node.js version info
# TYPE nodejs_version_info gauge
nodejs_version_info{version="${process.version}"} 1
`;

  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send(metrics);
}