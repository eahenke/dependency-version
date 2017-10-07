# Dependency-Version

Simple command line tool to query Github API for packages using a given dependency, and their versions.

### Installation
`npm install -g dependency-version`

### Options
* `-user` - Required.  Your Github username.
* `-token` - Required. Your Github personal token. See the Github API documentation for creating personal tokens.
* `-org` - Optional.  If set to true, queries an organization's repos.  Defaults to user.
* `-branch` - Optonal. Specific branch to query.  Will apply to all repos.

### Usage

`dependency-version USER/ORG DEPENDENCY -user=USER -token=PERSONAL_TOKEN -org=true -branch=dev`

### Example

```
node index.js eahenke express -user=eahenke -token=$GITHUB_TOKEN

Results for eahenke repos dependent on express

repo             dependency version
---------------  ------------------
choreIt          ~4.13.1           
doog             ^4.15.3           
serversidereact  ^4.15.3   

```