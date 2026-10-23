<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import CitySelect from '../components/CitySelect.vue';
import LangSwitch from '../components/LangSwitch.vue';
import PrivacyLinks from '../components/PrivacyLinks.vue';
import SocialButtons from '../components/SocialButtons.vue';
import { ApiError, errorMessage } from '../api';
import { register, type Registration } from '../session';

const router = useRouter();
const form = ref<Registration>({ username: '', email: '', password: '', city_id: 0 });
const fields = ref<Record<string, string>>({});
const error = ref('');
const busy = ref(false);

async function submit() {
  busy.value = true;
  error.value = '';
  fields.value = {};
  try {
    await register(form.value);
    router.push('/');
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) {
      fields.value = e.fields;
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="bgr-card bgr-form" @submit.prevent="submit">
    <LangSwitch />
    <h1>{{ $t('auth.register') }}</h1>
    <label>
      {{ $t('auth.username') }}
      <input v-model="form.username" autocomplete="username" required />
      <small v-if="fields.username" class="bgr-error">{{ fields.username }}</small>
    </label>
    <label>
      {{ $t('auth.email') }}
      <input v-model="form.email" type="email" autocomplete="email" required />
      <small v-if="fields.email" class="bgr-error">{{ fields.email }}</small>
    </label>
    <label>
      {{ $t('auth.password') }}
      <input v-model="form.password" type="password" autocomplete="new-password" minlength="8" required />
      <small v-if="fields.password" class="bgr-error">{{ fields.password }}</small>
    </label>
    <label>
      {{ $t('auth.city') }}
      <CitySelect v-model="form.city_id" />
      <small v-if="fields.city_id" class="bgr-error">{{ fields.city_id }}</small>
    </label>
    <p v-if="error" class="bgr-error">{{ error }}</p>
    <button :disabled="busy">{{ $t('auth.signUp') }}</button>
    <SocialButtons />
    <p class="bgr-muted">{{ $t('auth.haveAccount') }} <RouterLink to="/login">{{ $t('auth.enter') }}</RouterLink></p>
    <PrivacyLinks />
  </form>
</template>
