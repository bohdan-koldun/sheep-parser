FROM node:12

# Install Linux dependencies
#RUN apt-get update && apt-get install -y \
#    something

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json yarn.lock ./
RUN yarn install

# Bundle app source
COPY . .

# Setup environment variables
RUN cp .env.example .env

# Expose port and run server
EXPOSE 3000

CMD yarn start:prod
