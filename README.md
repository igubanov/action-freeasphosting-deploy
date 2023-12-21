# What is doing this action

Its a simple action that can deploy your single ZIP file to free ASP hosting [https://freeasphosting.net/](https://freeasphosting.net/). This service has a function `deploy`, you can upload a ZIP file, the service unzip it and place to root directory.

This action does the same:

1. authorize
2. load a few pages to get your information for the uploding
3. do post request with a ZIP file

## Usage

For using you should set a few parameters:

```yml
- name: Deploying
      id: deploy-to-freeasphosting
      uses: igubanov/action-freeasphosting-deploy
      with:
        login: ${{ secrets.FREEASPHOSTING_LOGIN }}
        password: ${{ secrets.FREEASPHOSTING_PASSWORD }}
        pathToZipFile: 'test.zip'
```

all parameters are mandatory, `pathToZipFile` - path to local file (place / builded or downloaded in the current job)
