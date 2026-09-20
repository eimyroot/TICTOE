# Security Policy

## Reporting a vulnerability

Do not disclose suspected vulnerabilities through public issues.

Report them privately to the repository owner with the affected component, reproduction steps, expected impact, and a minimal proof of concept where appropriate. Do not include third-party secrets or personal data.

## Supported state

The latest state on the default branch is the maintained development version unless a release says otherwise.

## Security expectations

- secrets must not be committed;
- authentication and authorization controls must not be bypassed;
- untrusted input must be validated at trust boundaries;
- dependencies should be updated deliberately and reviewed for impact;
- security-sensitive changes should include tests where practical.
